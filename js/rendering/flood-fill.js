// Four-connected scanline fill, with a byte mask and a span stack instead of recursion.
export function floodFill(data,width,height,x,y,colour,opacity,tolerance,mask=null) {
  x=Math.floor(x);y=Math.floor(y);if(x<0||y<0||x>=width||y>=height)return data;
  const seed=(y*width+x)*4, a=data[seed+3]/255;
  const target=[data[seed]*a,data[seed+1]*a,data[seed+2]*a,data[seed+3]];
  const seen=new Uint8Array(width*height),stack=[y*width+x];
  const matches=p=>{
    if(seen[p]||mask&&!mask[p*4+3])return false;
    const i=p*4,alpha=data[i+3]/255;
    return Math.max(Math.abs(data[i]*alpha-target[0]),Math.abs(data[i+1]*alpha-target[1]),Math.abs(data[i+2]*alpha-target[2]),Math.abs(data[i+3]-target[3]))<=tolerance;
  };
  while(stack.length){
    const p=stack.pop();if(!matches(p))continue;const row=Math.floor(p/width),start=row*width,end=start+width;
    let l=p,r=p;while(l>start&&matches(l-1))l--;while(r+1<end&&matches(r+1))r++;
    let above=false,below=false;
    for(let q=l;q<=r;q++){
      seen[q]=1;const i=q*4,sa=opacity*(mask?mask[i+3]/255:1),da=data[i+3]/255,oa=sa+da*(1-sa);
      for(let c=0;c<3;c++)data[i+c]=oa?(colour[c]*sa+data[i+c]*da*(1-sa))/oa:0;data[i+3]=oa*255;
      const top=row>0&&matches(q-width),bottom=row+1<height&&matches(q+width);
      if(top&&!above)stack.push(q-width);if(bottom&&!below)stack.push(q+width);above=top;below=bottom;
    }
  }
  return data;
}
