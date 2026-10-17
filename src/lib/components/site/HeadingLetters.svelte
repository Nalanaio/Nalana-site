<script>
  export let text='';
</script>

<span aria-hidden="true">{#each text.split(' ') as word,index}{#if index>0}{' '}{/if}<span class="w">{#each [...word] as character}<span class="ch">{character}</span>{/each}</span>{/each}</span>
