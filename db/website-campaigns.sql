-- Apply once to the existing Azure SQL database before enabling the website flag.
-- A separate contained user gets EXECUTE on these two procedures only, no access to accounts.
IF OBJECT_ID('dbo.website_campaign_daily', 'U') IS NULL
CREATE TABLE dbo.website_campaign_daily (
    day date NOT NULL,
    bucket binary(32) NOT NULL,
    source nvarchar(32) NOT NULL,
    medium nvarchar(32) NOT NULL,
    campaign nvarchar(120) NOT NULL,
    platform varchar(8) NOT NULL,
    page_views bigint NOT NULL DEFAULT 0,
    download_requests bigint NOT NULL DEFAULT 0,
    signups bigint NOT NULL DEFAULT 0,
    CONSTRAINT pk_website_campaign_daily PRIMARY KEY (day, bucket)
);
GO
CREATE OR ALTER PROCEDURE dbo.record_website_campaign
    @event varchar(20), @source nvarchar(32), @medium nvarchar(32),
    @campaign nvarchar(120), @platform varchar(8)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    IF @event NOT IN ('page_view', 'download_request', 'signup') OR @platform NOT IN ('web', 'mac', 'windows')
        THROW 50001, 'Unsupported campaign increment.', 1;
    DECLARE @day date = CONVERT(date, SYSUTCDATETIME()), @lock int, @bucket binary(32);
    SET @bucket = HASHBYTES('SHA2_256', CONCAT(@source, '|', @medium, '|', @campaign, '|', @platform));
    -- Existing groups use one atomic row update; only new groups serialize the cap check.
    UPDATE dbo.website_campaign_daily SET
        page_views = page_views + CASE WHEN @event = 'page_view' THEN 1 ELSE 0 END,
        download_requests = download_requests + CASE WHEN @event = 'download_request' THEN 1 ELSE 0 END,
        signups = signups + CASE WHEN @event = 'signup' THEN 1 ELSE 0 END
    WHERE day = @day AND bucket = @bucket;
    IF @@ROWCOUNT = 1 RETURN;
    BEGIN TRANSACTION;
    -- Serializes concurrent inserts and cardinality checks across serverless instances.
    EXEC @lock = sys.sp_getapplock @Resource = 'website_campaign_daily', @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 500;
    IF @lock < 0 THROW 50002, 'Campaign counter is busy.', 1;
    DELETE FROM dbo.website_campaign_daily WHERE day < DATEADD(day, -365, @day);
    IF NOT EXISTS (SELECT 1 FROM dbo.website_campaign_daily WHERE day = @day AND bucket = @bucket)
       AND (SELECT COUNT(*) FROM dbo.website_campaign_daily WHERE day = @day) >= 500
    BEGIN
        SET @source = 'unknown'; SET @medium = 'unknown'; SET @campaign = 'overflow';
        SET @bucket = HASHBYTES('SHA2_256', CONCAT(@source, '|', @medium, '|', @campaign, '|', @platform));
    END;
    UPDATE dbo.website_campaign_daily SET
        page_views = page_views + CASE WHEN @event = 'page_view' THEN 1 ELSE 0 END,
        download_requests = download_requests + CASE WHEN @event = 'download_request' THEN 1 ELSE 0 END,
        signups = signups + CASE WHEN @event = 'signup' THEN 1 ELSE 0 END
    WHERE day = @day AND bucket = @bucket;
    IF @@ROWCOUNT = 0
        INSERT dbo.website_campaign_daily (day, bucket, source, medium, campaign, platform, page_views, download_requests, signups)
        VALUES (@day, @bucket, @source, @medium, @campaign, @platform,
            CASE WHEN @event = 'page_view' THEN 1 ELSE 0 END,
            CASE WHEN @event = 'download_request' THEN 1 ELSE 0 END,
            CASE WHEN @event = 'signup' THEN 1 ELSE 0 END);
    COMMIT;
END;
GO
CREATE OR ALTER PROCEDURE dbo.read_website_campaigns @start date, @end date
AS
BEGIN
    SET NOCOUNT ON;
    IF @start IS NULL OR @end IS NULL OR @end < @start OR DATEDIFF(day, @start, @end) >= 90 OR @end > CONVERT(date, SYSUTCDATETIME())
        THROW 50003, 'Unsupported campaign report window.', 1;
    DELETE FROM dbo.website_campaign_daily WHERE day < DATEADD(day, -365, CONVERT(date, SYSUTCDATETIME()));
    SELECT day, source, medium, campaign, platform, page_views, download_requests, signups
    FROM dbo.website_campaign_daily
    WHERE day BETWEEN @start AND @end AND day >= DATEADD(day, -365, CONVERT(date, SYSUTCDATETIME()))
    ORDER BY day DESC, source, campaign, platform;
END;
