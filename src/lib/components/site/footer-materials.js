/** Milliseconds each material N stays on screen while the footer N is hovered. */
export const FOOTER_MATERIAL_MS=120;

// Crops copied from the Figma "NALANA Emblem Material Showcase" and
// "Seven tactile NALANA logo material studies" frames, in their left-to-right
// canvas order. Each frame is 455px tall; `width` is its Figma width and
// `crop` is the sheet's [left, top, width, height] in % of that frame.
const showcase='/assets/site/logo-materials/sheet-showcase.png';
const studies='/assets/site/logo-materials/sheet-studies.png';
export const FOOTER_MATERIALS=[
  {name:'flowers',sheet:showcase,width:445.46,crop:[-14.99,-7.76,388.65,253.51]},
  {name:'graffiti',sheet:showcase,width:433.88,crop:[-150.6,-7.81,398.89,253.8]},
  {name:'foil balloon',sheet:showcase,width:442.55,crop:[-278.13,-7.79,391.98,254.14]},
  {name:'gummy bears',sheet:studies,width:422.77,crop:[-125.19,-13.55,461.7,286.34]},
  {name:'kiwi',sheet:studies,width:428.57,crop:[-268.27,-125.08,407.24,255.62]},
  {name:'bubblegum',sheet:studies,width:420.48,crop:[-157.53,-125.24,415.44,255.81]},
  {name:'stained glass',sheet:studies,width:417.08,crop:[-243.01,-13.62,470.72,287.88]},
  {name:'rusted steel',sheet:studies,width:422.43,crop:[-352.71,-13.66,466.29,288.61]},
  {name:'moss',sheet:studies,width:428.29,crop:[-12.03,-12.79,453.23,284.33]}
];
export const FOOTER_MATERIAL_FRAME_HEIGHT=455;

/** Material to show next frame. The run loops through every material for as long as the
 * pointer stays on the N; leaving is what returns it to white. Follows the 120ms schedule,
 * but after a slow frame it advances one step at a time so no material is skipped.
 * @param {number} current index on screen now (-1 = white) @param {number} elapsed ms since the hover began
 * @param {number} [shown] materials shown so far in this hover, including the current one */
export function nextFooterMaterial(current,elapsed,shown=current+1,count=FOOTER_MATERIALS.length,stepMs=FOOTER_MATERIAL_MS){
  if(current<0)return -1;
  const due=Math.floor(Math.max(0,elapsed)/stepMs)+1;
  return due>shown?(current+1)%count:current;
}
