import {canManage} from './auth.js';

// Primary responsibility for the current stage; substitute permissions are still
// checked independently by each write endpoint.
export function taskViewer(user, task, reviewedByMe=false) {
 const t=task, own=t.creator_id===user.id;
 const manages=canManage(user,t.department_id);
 const review=t.state==='editorial'&&canManage(user,'editorial')
  ||t.state==='internal'&&(user.role==='admin'||t.reviewers.some(r=>r.id===user.id))
  ||['teacher1','teacher2'].includes(t.state)&&user.role==='teacher'&&t[t.state+'_id']===user.id
  ||t.state==='content'&&user.role==='teacher'&&t.teacher_id===user.id
  ||t.state==='acceptance'&&(manages||t.kind==='web_article'&&canManage(user,'editorial'));
 let action=null;
 if(['source_pending','source_returned'].includes(t.state)&&own)action='source';
 else if(t.state==='awaiting_assignment'&&manages)action='assign';
 else if(review)action='review';
 else if(['awaiting_submission','returned'].includes(t.state)&&t.assignee_id===user.id)action='submit';
 else if(t.state==='awaiting_publish'&&t.assignee_id===user.id)action='publish';
 const dept=t.department_name||'承接部门';
 const needsContent=t.review_mode&&(!t.version||t.version.phase==='content'&&t.state==='returned');
 const next={source_pending:['补交供稿','需求发起人'],source_returned:['修改供稿','需求发起人'],
  editorial:['审核供稿','采编部部长'],awaiting_assignment:['安排承接',dept+'部长'],
  awaiting_submission:[t.kind==='publication'?'提交稿件':needsContent?'提交待审稿件':'提交成果',t.assignee_name||'承接人'],
  returned:[needsContent?'修改待审稿件':'修改并重交',t.assignee_name||'原承接人'],internal:['处理内审','运营部审校部长'],
  teacher1:['老师一审',t.teacher1_name||'一审老师'],teacher2:['老师二审',t.teacher2_name||'二审老师'],
  content:['内容审校','指定指导老师'],acceptance:['验收成果',dept+'部长'],
  awaiting_publish:['确认发布',t.assignee_name||'承接人'],
  archived:[t.archive_reason?'工时未自动核算':'查看归档成果',t.archive_reason?'强制归档':'已完成'],
  recorded:['查看工时记录','已登记']}[t.state]||['查看进度',dept];
 return {createdByMe:own,action,reviewedByMe:user.role!=='external'&&!!reviewedByMe,
  nextLabel:next[0],ownerLabel:user.role==='external'&&['awaiting_submission','returned','awaiting_publish'].includes(t.state)?'承接人':user.role==='external'&&['teacher1','teacher2'].includes(t.state)?(t.state==='teacher1'?'一审老师':'二审老师'):next[1]};
}
