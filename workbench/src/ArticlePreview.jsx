import React,{useEffect,useId,useRef,useState} from 'react';
import {MessageSquare} from 'lucide-react';
import {ActionForm,Btn,api,setBody} from './App.jsx';

export const reviewLabels={editorial:'采编内容审核',internal:'部长内审',teacher1:'老师一审',teacher2:'老师二审'};

function rangeFromOffsets(root,start,end){
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
 let offset=0,first,last;
 while(walker.nextNode()){
  const node=walker.currentNode;
  const next=offset+node.length;
  if(!first&&start<next)first=[node,start-offset];
  if(first&&end<=next){last=[node,end-offset];break;}
  offset=next;
 }
 if(!first||!last)return null;
 const range=document.createRange();
 range.setStart(...first);range.setEnd(...last);
 return range;
}

export function ArticlePreview({version,annotations=[],canAnnotate,taskId,onSaved}){
 const content=useRef(null);
 const [selection,setSelection]=useState(null);
 const [opened,setOpen]=useState(false);
 const [focused,setFocused]=useState(null);
 const id=useId();
 const comments=annotations.filter(item=>item.version_id===version.id);

 useEffect(()=>{
  function capture(){
   const root=content.current,selected=window.getSelection();
   if(!canAnnotate||!root||!selected?.rangeCount||selected.isCollapsed)return;
   const range=selected.getRangeAt(0);
   if(!root.contains(range.startContainer)||!root.contains(range.endContainer))return;
   const quote=range.toString();
   if(!quote.trim()||quote.length>3000){setSelection(null);return;}
   const before=document.createRange();
   before.selectNodeContents(root);
   before.setEnd(range.startContainer,range.startOffset);
   const start=before.toString().length;
   setSelection({quote,start,end:start+quote.length});
  }
  document.addEventListener('selectionchange',capture);
  return ()=>document.removeEventListener('selectionchange',capture);
 },[canAnnotate]);

 useEffect(()=>{
  if(!CSS.highlights||!content.current)return;
  const ranges=comments.map(item=>rangeFromOffsets(content.current,item.start_offset,item.end_offset)).filter(Boolean);
  CSS.highlights.set('article-comments',new Highlight(...ranges));
  const item=comments.find(item=>item.id===focused);
  const range=item&&rangeFromOffsets(content.current,item.start_offset,item.end_offset);
  if(range){
   const active=new Highlight(range);
   active.priority=1;
   CSS.highlights.set('article-active-comment',active);
  }
  return ()=>{
   CSS.highlights.delete('article-comments');
   CSS.highlights.delete('article-active-comment');
  };
 },[version,comments,focused]);

 function jump(item){
  const range=rangeFromOffsets(content.current,item.start_offset,item.end_offset);
  if(!range)return;
  setFocused(item.id);
  const element=range.startContainer.parentElement;
  element?.scrollIntoView({block:'center',behavior:'smooth'});
  if(!CSS.highlights){
   const selected=window.getSelection();
   selected?.removeAllRanges();
   selected?.addRange(range);
  }
 }

 if(!version.body&&!version.preview_html)return null;
 return <div className="article-review">
  <div className="article-page">
   {version.preview_html
    ?<div ref={content} className="article-copy rich" dangerouslySetInnerHTML={{__html:version.preview_html}}/>
    :<div ref={content} className="article-copy">{version.body}</div>}
  </div>
  {(canAnnotate||comments.length>0)&&<aside className="article-comments" aria-labelledby={id}>
   <h3 id={id}><MessageSquare size={16}/> 文中批注</h3>
   {canAnnotate&&<div className="article-comment-tools">
    <p className="subtle">选中正文中的文字即可添加批注。</p>
    <Btn type="button" disabled={!selection} onClick={()=>setOpen(true)}>添加批注</Btn>
    {opened&&selection&&<ActionForm label="保存批注" onSubmit={async form=>{
     await api('/tasks/'+taskId+'/annotations',setBody('POST',{versionId:version.id,...selection,body:form.get('comment')}));
     setOpen(false);setSelection(null);window.getSelection()?.removeAllRanges();onSaved();
    }}>
     <blockquote>{selection.quote}</blockquote>
     <label>批注意见<textarea autoFocus name="comment" required maxLength={3000} rows="3"/></label>
    </ActionForm>}
   </div>}
   {comments.map(item=><button key={item.id} type="button" className="article-comment"
    aria-pressed={focused===item.id} onClick={()=>jump(item)}>
    <span>{item.actor_name} · {reviewLabels[item.stage]}</span>
    <q>{item.quote}</q><strong>{item.body}</strong>
   </button>)}
  </aside>}
 </div>;
}

export function ManuscriptFields({initialBody='',initialPreview='',initialHtml='',source=false}){
 const [body,setBodyText]=useState(initialBody);
 const [html,setHtml]=useState(initialHtml);
 const [fileError,setFileError]=useState('');
 function extract(value){
  const template=document.createElement('template');
  template.innerHTML=value;
  return template.content.querySelector('#js_content')?.innerHTML??template.innerHTML;
 }
 return <>
  <label>{source?'供稿正文':'稿件正文'}
   <textarea name="body" rows="7" maxLength={100000} value={body} placeholder="可直接粘贴公众号网页中选中的正文"
    onChange={e=>{setBodyText(e.target.value);setHtml('');}}
    onPaste={e=>{
     const rich=e.clipboardData.getData('text/html');
     if(!rich||rich.length>600000)return;
     e.preventDefault();
     setHtml(extract(rich));
     setBodyText(e.clipboardData.getData('text/plain').slice(0,100000));
    }}/></label>
  <label>导入文章 HTML<input type="file" accept=".html,.htm,text/html" onChange={async e=>{
   const file=e.currentTarget.files[0];
   if(!file)return;
   if(file.size>600000){setFileError('HTML 文件最多 600 KB');return;}
   try{
    const content=extract(await file.text());
    setHtml(content);setFileError('');
    const template=document.createElement('template');
    template.innerHTML=content;
    for(const element of template.content.querySelectorAll('script,style,iframe,object'))element.remove();
    const plain=template.content.textContent;
    setBodyText(plain.slice(0,100000));
   }catch{setFileError('文章文件读取失败');}
  }}/></label>
  {fileError&&<p className="error" role="alert">{fileError}</p>}
  {html&&<p className="subtle">已载入富文本。编辑正文会改用纯文本预览。</p>}
  <input type="hidden" name="previewHtml" value={html}/>
  {!source&&<label>公众号原预览链接<input type="url" name="preview" defaultValue={initialPreview}/></label>}
  <label>{source?'供稿与素材':'稿件附件'}<input type="file" name="files" multiple/></label>
 </>;
}
