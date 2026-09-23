import { icon } from '../components/panels.js';
import { clone, createLayer, checkSize } from '../model/document.js';
import { isSelectionTool } from '../model/pixel-region.js';
import { canGradient, isPath, pathBounds, tracePath, validGradient } from '../model/vector.js';
import { localToWorld } from './geometry.js';
import { sourcePoint, paintSurface, selectionMask, stamp, strokeSamples, composeStroke, pngBlob } from '../rendering/paint.js';
import { surface } from '../rendering/effects.js';
import { floodFill } from '../rendering/flood-fill.js';

const names={eyedropper:'Eyedropper',brush:'Brush',eraser:'Eraser',fill:'Fill',pen:'Pen',gradient:'Gradient'};
const paintTools=['brush','eraser','fill'];
const toolIcons={eyedropper:'eyedropper',brush:'paint-brush',eraser:'eraser-tool',fill:'paint-bucket',pen:'pen',gradient:'color-background'};
const hexRGB=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const anchor=p=>({...p,in:{...p},out:{...p}});
const field=(label,key,value,min,max,step=1)=>`<label><span>${label}</span><input data-setting="${key}" type="number" value="${value}" min="${min}" max="${max}" step="${step}"></label>`;

const toolButton=(action,label,glyph,disabled=false)=>`<button type="button" data-tool-action="${action}" title="${label}" ${disabled?'disabled':''}>${icon(glyph)}<span>${label}</span></button>`;
const slider=(label,key,value,min,max,step=1,scope='setting')=>`<label class="tool-slider"><span>${label}</span><input data-${scope}="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"><output>${max===1?Math.round(value*100)+'%':value}</output></label>`;

export class ToolController {
  constructor(workspace,options) {
    this.workspace=workspace;Object.assign(this,options);
    this.settings={foreground:'#000000',background:'#ffffff',opacity:1,size:20,hardness:1,tolerance:0,gradientType:'linear'};
    this.token=0;this.revision=0;this.anchorIndex=0;this.stopIndex=0;this.gesture=null;this.path=null;this.cursor=null;this.busy=false;
    const area=workspace.element;
    for(const type of ['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture','dblclick'])area.addEventListener(type,e=>this.route(type,e),true);
    area.addEventListener('pointerleave',()=>{this.cursor=null;workspace.draw();});
    this.controls.addEventListener('change',e=>this.change(e));
    this.controls.addEventListener('input',e=>{
      if(e.target.type!=='range')return;
      const output=e.target.closest('label').querySelector('output');
      output.value=Number(e.target.max)===1?Math.round(Number(e.target.value)*100)+'%':e.target.value;
      if(e.target.dataset.setting)this.change(e);
    });
    document.addEventListener('click',e=>this.action(e));
    window.addEventListener('blur',()=>this.cancel());
  }
  active(){return !!names[this.workspace.tool];}
  eligible(layer=this.getLayer()){return layer?.type==='image'&&layer.visible&&!layer.locked;}
  canUse(tool) {
    if(!paintTools.includes(tool))return true;
    if(!this.eligible())return false;
    const image=this.getAssets().images.get(this.getLayer().assetId);
    if(!image)return false;
    try{checkSize(image.width,image.height);return true;}catch{return false;}
  }
  local(p,layer){return sourcePoint(p,layer.transform,1,1);}
  world(p,layer){const t=layer.transform;return localToWorld({x:(p.x-.5)*t.width,y:(p.y-.5)*t.height},t);}
  sync(){
    const layer=this.getLayer();
    if(this.gesture && (this.gesture.layer && (layer!==this.gesture.layer||layer.locked||!layer.visible)))this.cancel();
    if(!this.controls.contains(document.activeElement))this.renderControls();
  }
  canFinishPath(){return (this.path?.length || 0)>=2;}
  updateFinishButton(){const button=this.controls.querySelector('[data-tool-action="finish-path"]');if(button)button.disabled=!this.canFinishPath();}
  renderControls(){
    const tool=this.workspace.tool,s=this.settings,l=this.getLayer();
    this.controls.hidden=!this.active();if(!this.active())return;
    let html=`${icon(toolIcons[tool])}<strong>${names[tool]}</strong><label>Foreground<input aria-label="Foreground colour" data-setting="foreground" type="color" value="${s.foreground}"></label><label>Background<input aria-label="Background colour" data-setting="background" type="color" value="${s.background}"></label>`;
    if(paintTools.includes(tool)||tool==='eyedropper')html+=slider('Opacity','opacity',s.opacity,0,1,.01);
    if(['brush','eraser'].includes(tool))html+=field('Size (px)','size',s.size,1,1024)+slider('Hardness','hardness',s.hardness,0,1,.01);
    if(tool==='fill')html+=slider('Tolerance','tolerance',s.tolerance,0,255);
    if(tool==='pen'){
      html+=toolButton('new-path','New path','add')+toolButton('finish-path','Finish path','checkmark-circle',!this.canFinishPath());
      if(isPath(l)&&!l.locked){this.anchorIndex=Math.min(this.anchorIndex,l.shape.anchors.length-1);
        html+=toolButton('smooth','Smooth','bezier-curve')+toolButton('corner','Corner','square')+toolButton('delete-anchor','Delete anchor','delete');
      }
    }
    if(tool==='gradient'){
      const g=canGradient(l)&&l.shape.gradient;html+=`<label>Type<select data-setting="gradientType"><option value="linear" ${(g?.type||s.gradientType)==='linear'?'selected':''}>Linear</option><option value="radial" ${(g?.type||s.gradientType)==='radial'?'selected':''}>Radial</option></select></label>`;
      if(g&&!l.locked){this.stopIndex=Math.min(this.stopIndex,g.stops.length-1);const stop=g.stops[this.stopIndex];

        html+=`<label>Stop<select data-vector="stop-index">${g.stops.map((_,i)=>`<option value="${i}" ${i===this.stopIndex?'selected':''}>${i+1}</option>`).join('')}</select></label>${slider('Position','offset',stop.offset,0,1,.01,'stop')}<label>Stop colour<input data-stop="colour" type="color" value="${stop.colour}"></label>${slider('Stop opacity','opacity',stop.opacity,0,1,.01,'stop')}`+toolButton('add-stop','Add stop','add',g.stops.length>=32)+toolButton('remove-stop','Remove stop','subtract',g.stops.length<=2)+toolButton('sample-stop','Pick stop colour','eyedropper');
      }
    }
    this.controls.innerHTML=html;
  }
  change(e){
    const el=e.target,key=el.dataset.setting,l=this.getLayer(),numeric=['number','range'].includes(el.type);
    if(key){let value=numeric?Number(el.value):el.value;if(numeric){if(el.value===''||!Number.isFinite(value))return;value=Math.max(Number(el.min),Math.min(Number(el.max),value));el.value=value;}this.settings[key]=value;
      if(key==='gradientType'&&canGradient(l)&&l.shape.gradient&&!l.locked){const shape=clone(l.shape);shape.gradient.type=value;this.patch(l,{shape},'Change gradient type');}return;}
    if(el.dataset.vector==='stop-index'){this.stopIndex=Number(el.value);this.renderControls();this.workspace.draw();return;}
    if(!l||l.locked||!l.visible)return;const shape=clone(l.shape);
    if(!shape.gradient)return;
    if(el.dataset.gradient){const n=Number(el.value);if(!Number.isFinite(n)||Math.abs(n)>10)return;const [a,b]=el.dataset.gradient.split('.');shape.gradient[a][b]=n;}
    if(el.dataset.stop){const k=el.dataset.stop,v=k==='colour'?el.value:Number(el.value);if(k!=='colour'&&(!Number.isFinite(v)||v<0||v>1))return;const stop=shape.gradient.stops[this.stopIndex];stop[k]=v;shape.gradient.stops.sort((a,b)=>a.offset-b.offset);this.stopIndex=shape.gradient.stops.indexOf(stop);}
    if(validGradient(shape.gradient))this.patch(l,{shape},'Edit gradient');else this.notify('Gradient handles must be separated.');
  }
  action(e){
    const action=e.target.closest('[data-tool-action]')?.dataset.toolAction;if(!action)return;
    const l=this.getLayer();
    if(action==='rasterise'){this.cancel();this.rasterise();return;}
    if(action==='new-path'){this.cancel();this.select(null);return;}
    if(action==='finish-path'){this.finishPath(false);return;}
    if(!l||l.locked||!l.visible)return;
    if(['smooth','corner','delete-anchor'].includes(action)&&isPath(l)){
      const shape=clone(l.shape),i=this.anchorIndex,a=shape.anchors[i];
      if(action==='delete-anchor'){if(shape.anchors.length<=2){this.notify('A path needs at least two anchors.');return;}shape.anchors.splice(i,1);this.anchorIndex=Math.max(0,i-1);}
      if(action==='corner'){a.in={x:a.x,y:a.y};a.out={x:a.x,y:a.y};}
      if(action==='smooth'){const p=shape.anchors[(i+shape.anchors.length-1)%shape.anchors.length],n=shape.anchors[(i+1)%shape.anchors.length];a.in={x:a.x-(n.x-p.x)/6,y:a.y-(n.y-p.y)/6};a.out={x:a.x+(n.x-p.x)/6,y:a.y+(n.y-p.y)/6};}
      this.commitPathEdit(l,shape);this.renderControls();return;
    }
    if(!l.shape?.gradient)return;const shape=clone(l.shape),g=shape.gradient;
    if(action==='sample-stop'){this.sampleTarget={layer:l,index:this.stopIndex};this.notify('Click the canvas to sample this stop.');return;}
    if(action==='solid'){shape.fillOpacity=g.solidFillOpacity ?? shape.fillOpacity;delete shape.gradient;}
    if(action==='add-stop'&&g.stops.length<32){const stop={offset:.5,colour:this.settings.foreground,opacity:this.settings.opacity};g.stops.push(stop);g.stops.sort((a,b)=>a.offset-b.offset);this.stopIndex=g.stops.indexOf(stop);}
    if(action==='remove-stop'&&g.stops.length>2){g.stops.splice(this.stopIndex,1);this.stopIndex=Math.max(0,this.stopIndex-1);}
    this.patch(l,{shape},'Edit gradient');this.renderControls();
  }
  route(type,e){
    if(e.target.closest('#tool-options, button, input, select, label'))return;
    const w=this.workspace,ps=this.selection;
    if(type==='pointercancel'||type==='lostpointercapture'){
      if(this.gesture?.pointerId===e.pointerId)this.cancel();
      if(ps.draft?.kind!=='polygon-lasso')ps.cancelDraft();return;
    }
    if(isSelectionTool(w.tool)){
      if(type==='pointerdown')ps.down(e);if(type==='pointermove')ps.move(e);
      if(type==='pointerup'&&ps.draft?.pointerId===e.pointerId){e.stopImmediatePropagation();ps.complete();}
      if(type==='dblclick'&&ps.draft?.kind==='polygon-lasso'){e.preventDefault();e.stopImmediatePropagation();ps.complete();}return;
    }
    if(!this.active())return;
    if(type==='pointermove'){w.pointer={clientX:e.clientX,clientY:e.clientY};this.cursor=w.point(e);}
    if(w.gesture?.type==='pan'||type==='pointerdown'&&(e.button===1||w.space))return;
    if(type==='pointerdown'&&e.button!==0)return;
    e.stopImmediatePropagation();if(type!=='pointermove')e.preventDefault();
    if(type==='pointerdown'){this.beforeGesture();w.element.focus({preventScroll:true});this.down(e);}
    if(type==='pointermove')this.move(e);
    if(type==='pointerup')this.up(e);
  }
  capture(e){this.gesture.pointerId=e.pointerId;this.workspace.element.setPointerCapture(e.pointerId);}
  release(g){if(g?.pointerId!==undefined&&this.workspace.element.hasPointerCapture(g.pointerId))this.workspace.element.releasePointerCapture(g.pointerId);}
  cancel(){
    this.token++;this.workerReject?.(new Error('Fill cancelled.'));this.workerReject=null;this.worker?.terminate();this.worker=null;this.busy=false;const g=this.gesture;this.gesture=null;
    if(g?.before&&g.layer){g.layer.shape=g.before;g.layer.transform=g.transform;}
    this.path=null;this.updateFinishButton();this.sampleTarget=null;this.renderer.preview=null;this.release(g);this.preview();this.workspace.draw();
  }
  down(e){
    if(this.busy||this.gesture)return;const p=this.workspace.point(e),tool=this.workspace.tool,l=this.getLayer();
    if(tool==='eyedropper'||this.sampleTarget){this.sample(p);return;}
    if(paintTools.includes(tool)){
      if(!this.eligible()){this.notify('Select an unlocked image or create a paint layer.');return;}
      try{
        const base=paintSurface(l,this.getAssets().images.get(l.assetId)),point=sourcePoint(p,l.transform,base.width,base.height);
        if(point.x<0||point.y<0||point.x>=base.width||point.y>=base.height)return;
        const mask=selectionMask(this.selection.current()?.points,base.width,base.height);
        this.gesture={type:tool,layer:l,snapshot:clone(l),document:this.getDocument(),assets:this.getAssets(),base,mask,last:point,settings:{...this.settings}};
        if(tool==='fill'){this.fill(point);return;}
        this.gesture.stroke=surface(base.width,base.height);stamp(this.gesture.stroke.getContext('2d'),point,this.settings.size,this.settings.hardness,this.settings.foreground);this.capture(e);this.paintPreview();
      }catch(error){this.gesture=null;this.notify(error.message,true);}return;
    }
    if(tool==='pen'){
      const handle=e.target.closest('[data-anchor-handle]');
      if(handle&&isPath(l)&&!l.locked&&l.visible){this.anchorIndex=Number(handle.dataset.anchorIndex);this.gesture={type:'anchor',layer:l,before:clone(l.shape),transform:clone(l.transform),part:handle.dataset.anchorHandle,index:this.anchorIndex};this.capture(e);this.renderControls();this.workspace.draw();return;}
      if(this.path&&this.path.length>=2&&Math.hypot(p.x-this.path[0].x,p.y-this.path[0].y)*this.workspace.view.zoom<8){this.finishPath(true);return;}
      if(!this.path)this.path=[];
      if(this.path.length>=4096){this.notify('Finish this path before adding more anchors.');return;}
      this.path.push(anchor(p));this.updateFinishButton();this.gesture={type:'pen-point',index:this.path.length-1};this.capture(e);this.workspace.draw();return;
    }
    if(tool==='gradient'){
      if(l&&(l.locked||!l.visible)){this.notify('Select a visible, unlocked layer.');return;}
      let layer=l,isNew=!canGradient(l);
      if(isNew){layer=createLayer('shape',this.getDocument().canvas,{name:'Gradient'});Object.assign(layer.transform,{width:this.getDocument().canvas.width,height:this.getDocument().canvas.height});layer.shape.radius=0;}
      const before=clone(layer.shape),point=this.local(p,layer),handle=e.target.closest('[data-gradient-handle]')?.dataset.gradientHandle;
      const g=clone(layer.shape.gradient)||{type:this.settings.gradientType,solidFillOpacity:before.fillOpacity,start:point,end:point,stops:[{offset:0,colour:this.settings.foreground,opacity:this.settings.opacity},{offset:1,colour:this.settings.background,opacity:1}]};
      if(!handle){g.start=point;g.end={x:point.x+1e-7,y:point.y};}
      layer.shape.gradient=g;layer.shape.fillOpacity=before.gradient ? before.fillOpacity : before.fillOpacity || 1;
      this.gesture={type:'gradient',layer,before,transform:clone(layer.transform),isNew,part:handle||'end',start:p};this.capture(e);this.workspace.draw();
    }
  }
  move(e){
    const g=this.gesture,p=this.workspace.point(e);if(!g){if(['brush','eraser'].includes(this.workspace.tool))this.workspace.draw();return;}
    if(g.pointerId!==undefined&&g.pointerId!==e.pointerId)return;
    if(['brush','eraser'].includes(g.type)){
      const point=sourcePoint(p,g.layer.transform,g.base.width,g.base.height),ctx=g.stroke.getContext('2d');
      for(const sample of strokeSamples(g.last,point,g.settings.size))stamp(ctx,sample,g.settings.size,g.settings.hardness,g.settings.foreground);g.last=point;this.paintPreview();return;
    }
    if(g.type==='pen-point'){const a=this.path[g.index];a.out={...p};a.in={x:2*a.x-p.x,y:2*a.y-p.y};}
    if(g.type==='anchor'){
      const a=g.layer.shape.anchors[g.index],point=this.local(p,g.layer);
      if(g.part==='point'){const dx=point.x-a.x,dy=point.y-a.y;for(const h of [a.in,a.out]){h.x+=dx;h.y+=dy;}a.x=point.x;a.y=point.y;}
      else{a[g.part]=point;if(!e.altKey)a[g.part==='in'?'out':'in']={x:2*a.x-point.x,y:2*a.y-point.y};}this.preview();
    }
    if(g.type==='gradient'){g.layer.shape.gradient[g.part]=this.local(p,g.layer);this.preview();}
    this.workspace.draw();
  }
  up(e){
    const g=this.gesture;if(!g||g.pointerId!==e.pointerId)return;
    // Include the release position even when the browser coalesced the last move.
    this.move(e);
    if(['brush','eraser'].includes(g.type)){this.gesture=null;this.release(g);this.commitPaint(g,g.output);return;}
    this.gesture=null;this.release(g);
    if(g.type==='anchor'){const shape=clone(g.layer.shape);g.layer.shape=g.before;this.commitPathEdit(g.layer,shape);}
    if(g.type==='gradient'){
      const shape=clone(g.layer.shape);g.layer.shape=g.before;
      if(validGradient(shape.gradient)&&Math.hypot((shape.gradient.end.x-shape.gradient.start.x)*g.layer.transform.width,(shape.gradient.end.y-shape.gradient.start.y)*g.layer.transform.height)>=1){
        if(g.isNew){g.layer.shape=shape;this.insert(g.layer);}else if(!same(shape,g.before))this.patch(g.layer,{shape},'Draw gradient');
      }else this.preview();
    }
    this.workspace.draw();this.renderControls();
  }
  paintPreview(){const g=this.gesture;if(!g)return;g.output=composeStroke(g.base,g.stroke,g.mask,g.settings.opacity,g.type==='eraser',g.buffers ||= {});this.renderer.preview={layerId:g.layer.id,canvas:g.output,revision:++this.revision};this.preview();this.workspace.draw();}
  async fill(point){
    const g=this.gesture,token=++this.token;this.busy=true;
    try{
      const ctx=g.base.getContext('2d'),image=ctx.getImageData(0,0,g.base.width,g.base.height),mask=g.mask?.getContext('2d').getImageData(0,0,g.base.width,g.base.height).data;
      const args={width:g.base.width,height:g.base.height,x:point.x,y:point.y,colour:hexRGB(g.settings.foreground),opacity:g.settings.opacity,tolerance:g.settings.tolerance};
      let data;
      if(typeof Worker!=='undefined'){
        data=await new Promise((resolve,reject)=>{const worker=new Worker(new URL('../rendering/fill-worker.js',import.meta.url),{type:'module'});this.worker=worker;this.workerReject=reject;worker.onmessage=({data:r})=>{worker.terminate();this.worker=null;this.workerReject=null;r.error?reject(new Error(r.error)):resolve(new Uint8ClampedArray(r.buffer));};worker.onerror=()=>{worker.terminate();this.worker=null;reject(new Error('Fill processing failed.'));};worker.postMessage({...args,buffer:image.data.buffer,mask:mask?.buffer},[image.data.buffer,...(mask?[mask.buffer]:[])]);});
      }else data=floodFill(image.data,args.width,args.height,args.x,args.y,args.colour,args.opacity,args.tolerance,mask);
      if(token!==this.token)return;
      const out=surface(args.width,args.height);out.getContext('2d').putImageData(new ImageData(data,args.width,args.height),0,0);this.gesture=null;await this.commitPaint(g,out);
    }catch(error){if(token===this.token){this.gesture=null;this.busy=false;this.notify(error.message,true);}}
  }
  async commitPaint(g,canvas){
    const token=++this.token;this.busy=true;let meta,committed=false;
    const valid=()=>token===this.token&&g.document===this.getDocument()&&g.assets===this.getAssets()&&this.getLayer()===g.layer&&g.document.layers.includes(g.layer)&&same(g.layer,g.snapshot);
    try{
      const before=g.base.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data,after=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
      if(before.every((v,i)=>v===after[i]))return;
      const blob=await pngBlob(canvas);if(!valid())return;meta=await g.assets.add(blob);if(!valid())return;
      meta.name=`${g.layer.name}.png`;g.document.assets.push(meta);this.renderer.preview=null;this.patch(g.layer,{assetId:meta.id,eraseRegions:[]},names[g.type]+' pixels');committed=true;
    }catch(error){if(token===this.token)this.notify(error.message,true);}
    finally{if(meta&&!committed)g.assets.remove(meta.id);if(token===this.token){this.busy=false;this.renderer.preview=null;this.preview();}}
  }
  async newPaint(){
    const doc=this.getDocument(),assets=this.getAssets(),token=++this.token;this.busy=true;let meta,inserted=false;
    try{const canvas=surface(doc.canvas.width,doc.canvas.height),blob=await pngBlob(canvas);if(token!==this.token||doc!==this.getDocument())return;meta=await assets.add(blob);if(token!==this.token||doc!==this.getDocument())return;meta.name='Paint.png';doc.assets.push(meta);const l=createLayer('image',doc.canvas,{name:'Paint',assetId:meta.id});Object.assign(l.transform,{width:doc.canvas.width,height:doc.canvas.height});this.insert(l);inserted=true;}
    catch(error){if(token===this.token)this.notify(error.message,true);}finally{if(meta&&!inserted)assets.remove(meta.id);if(token===this.token)this.busy=false;}
  }
  async sample(p){
    const token=++this.token,doc=this.getDocument(),target=this.sampleTarget;this.sampleTarget=null;
    try{if(p.x<0||p.y<0||p.x>=doc.canvas.width||p.y>=doc.canvas.height)return;
      const canvas=surface(doc.canvas.width,doc.canvas.height);await this.renderer.renderDocument(clone(doc),this.getAssets(),canvas);if(token!==this.token||doc!==this.getDocument())return;
      const rgba=canvas.getContext('2d').getImageData(Math.floor(p.x),Math.floor(p.y),1,1).data;if(!rgba[3]){this.notify('This pixel is fully transparent.');return;}
      const colour='#'+[...rgba.slice(0,3)].map(v=>v.toString(16).padStart(2,'0')).join(''),opacity=rgba[3]/255;
      if(target&&doc.layers.includes(target.layer)&&!target.layer.locked&&target.layer.visible&&target.layer.shape.gradient?.stops[target.index]){const shape=clone(target.layer.shape);Object.assign(shape.gradient.stops[target.index],{colour,opacity});this.patch(target.layer,{shape},'Sample gradient colour');}
      else{Object.assign(this.settings,{foreground:colour,opacity});this.notify(`Sampled ${colour}`);}this.renderControls();
    }catch(error){this.notify(error.message,true);}
  }
  normalise(layer,shape){
    const t=layer.transform,anchors=shape.anchors.map(a=>({x:a.x*t.width,y:a.y*t.height,in:{x:a.in.x*t.width,y:a.in.y*t.height},out:{x:a.out.x*t.width,y:a.out.y*t.height}})),b=pathBounds(anchors);
    checkSize(Math.ceil(b.width),Math.ceil(b.height));
    const point=p=>({x:(p.x-b.x)/b.width,y:(p.y-b.y)/b.height});
    shape.anchors=anchors.map(a=>({...point(a),in:point(a.in),out:point(a.out)}));
    if(shape.gradient){for(const key of ['start','end'])shape.gradient[key]=point({x:shape.gradient[key].x*t.width,y:shape.gradient[key].y*t.height});}
    const centre=localToWorld({x:b.x+b.width/2-t.width/2,y:b.y+b.height/2-t.height/2},t);
    return {shape,transform:{...t,...centre,width:b.width,height:b.height}};
  }
  commitPathEdit(l,shape){try{const changes=this.normalise(l,shape);if(!same(changes,{shape:l.shape,transform:l.transform}))this.patch(l,changes,'Edit path');}catch(error){this.notify(error.message,true);this.preview();}}
  finishPath(closed){
    if(!this.canFinishPath())return;
    const l=createLayer('shape',this.getDocument().canvas,{name:'Path'}),b=pathBounds(this.path);
    try{checkSize(Math.ceil(b.width),Math.ceil(b.height));const point=p=>({x:(p.x-b.x)/b.width,y:(p.y-b.y)/b.height});
      Object.assign(l.transform,{x:b.x+b.width/2,y:b.y+b.height/2,width:b.width,height:b.height});Object.assign(l.shape,{kind:'path',closed,anchors:this.path.map(a=>({...point(a),in:point(a.in),out:point(a.out)})),stroke:this.settings.foreground,strokeWidth:2,strokeOpacity:this.settings.opacity,fillOpacity:0});
      this.anchorIndex=this.path.length-1;this.path=null;const g=this.gesture;this.gesture=null;this.release(g);this.insert(l);this.renderControls();
    }catch(error){this.notify(error.message,true);}
  }
  key(e){
    if(e.key==='Escape'&&(this.gesture||this.path||this.busy||this.sampleTarget)){e.preventDefault();this.cancel();return true;}
    if(this.workspace.tool==='pen'&&this.path&&['Enter','Backspace','Delete'].includes(e.key)){e.preventDefault();if(e.key==='Enter')this.finishPath(false);else{this.path.pop();if(!this.path.length)this.path=null;this.updateFinishButton();this.workspace.draw();}return true;}
    if(this.workspace.tool==='pen'&&isPath(this.getLayer())&&['Backspace','Delete'].includes(e.key)){e.preventDefault();this.action({target:{closest:()=>({dataset:{toolAction:'delete-anchor'}})}});return true;}
    return false;
  }
  overlay(){
    if(!this.active())return null;const l=this.getLayer(),z=this.workspace.view.zoom,r=5/z;
    let html=this.selection.current()?this.selection.overlay(l,z):'';
    const circle=(p,attrs='',selected=false)=>`<circle cx="${p.x}" cy="${p.y}" r="${selected?6.5/z:r}" fill="${selected?'#447af0':'white'}" stroke="${selected?'white':'#6799f5'}" stroke-width="${(selected?2:1)/z}" ${attrs}/>`;
    if(['brush','eraser'].includes(this.workspace.tool)&&this.cursor&&this.eligible()){
      const image=this.getAssets().images.get(l.assetId),t=l.transform,p=this.cursor;
      html+=`<ellipse cx="${p.x}" cy="${p.y}" rx="${this.settings.size*t.width/image.width/2}" ry="${this.settings.size*t.height/image.height/2}" transform="rotate(${t.rotation} ${p.x} ${p.y})" fill="none" stroke="white" stroke-width="${1/z}" style="filter:drop-shadow(0 0 1px black)" pointer-events="none"/>`;
    }
    if(this.workspace.tool==='pen'){
      const points=this.path||(isPath(l)&&l.visible&&!l.locked?l.shape.anchors.map(a=>({...this.world(a,l),in:this.world(a.in,l),out:this.world(a.out,l)})):[]);
      if(this.path?.length){const commands=[];tracePath({moveTo:(x,y)=>commands.push(`M${x} ${y}`),bezierCurveTo:(...v)=>commands.push('C'+v.join(' ')),closePath:()=>commands.push('Z')},{anchors:points,closed:false},1,1);html+=`<path d="${commands.join(' ')}" fill="none" stroke="#6799f5" stroke-width="${2/z}" pointer-events="none"/>`;}
      points.forEach((a,i)=>{for(const h of ['in','out']){html+=`<path d="M${a.x} ${a.y}L${a[h].x} ${a[h].y}" stroke="#6799f5" stroke-width="${1/z}" pointer-events="none"/>`;if(Math.hypot(a[h].x-a.x,a[h].y-a.y)>1e-6)html+=circle(a[h],`data-anchor-handle="${h}" data-anchor-index="${i}" style="pointer-events:all"`);}const selected=i===(this.path?this.path.length-1:this.anchorIndex);html+=circle(a,`data-anchor-handle="point" data-anchor-index="${i}" data-selected-anchor="${selected}" style="pointer-events:all"`,selected);});
    }
    const gl=this.gesture?.type==='gradient'?this.gesture.layer:l;
    if(this.workspace.tool==='gradient'&&gl?.visible&&!gl.locked&&gl?.shape?.gradient){const g=gl.shape.gradient,a=this.world(g.start,gl),b=this.world(g.end,gl);html+=`<path d="M${a.x} ${a.y}L${b.x} ${b.y}" stroke="#6799f5" stroke-width="${2/z}" pointer-events="none"/>`+circle(a,'data-gradient-handle="start" style="pointer-events:all"')+circle(b,'data-gradient-handle="end" style="pointer-events:all"');}
    return html;
  }
}
