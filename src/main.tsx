import React, { useEffect, useMemo, useRef, useState } from 'react';

import { createRoot } from 'react-dom/client';

import { ArrowUp, Award, Bell, Eye, Flag, Flame, Home, Moon, Plus, Send, Settings, Share2, Skull, Sparkles, Sun, Trophy, User, X } from 'lucide-react';

import './styles.css';

import { gameApi, type Advice, type Profile, type Situation } from './game-api';



const topicTags:Record<string,string[]>={Love:['ROMANCE'],Work:['WORK'],Friendship:['FRIENDS'],Family:['FAMILY'],Dating:['ROMANCE'],Money:['WORK'],College:['WORK'],Life:['OTHER'],Wellness:['OTHER'],Roommates:['HOUSE']};

const categories=Array.from(new Set(Object.values(topicTags).flat()));



function App(){

 const [userId,setUserId]=useState<string|null>(null);

 const [situations,setSituations]=useState<Situation[]>([]); const [situationsLoading,setSituationsLoading]=useState(true); const [situationsError,setSituationsError]=useState(''); const [profile,setProfile]=useState<Profile>({name:'New menace',handle:'@anonymous',points:0,avatar:'M',joined:'Today'});

 const [view,setView]=useState<'home'|'trending'|'leaderboard'>('home'); const [modal,setModal]=useState<'situation'|'advice'|'username'|null>(null); const [selected,setSelected]=useState<Situation|null>(null); const [toast,setToast]=useState(''); const [topic,setTopic]=useState('All'); const [page,setPage]=useState(1); const feedRef=useRef<HTMLDivElement>(null);

 const selectTopic=(next:string)=>{setTopic(next);setPage(1); if(view!=='home'){setView('home');} requestAnimationFrame(()=>requestAnimationFrame(()=>feedRef.current?.scrollIntoView({behavior:'smooth'}))); };

 const notify=(message:string)=>{setToast(message); setTimeout(()=>setToast(''),2600)};

 useEffect(()=>{

  let cancelled=false;

  (async()=>{

   try{

    const uid=await gameApi.getUserId();

    if(cancelled)return;

    setUserId(uid);

    const existing=await gameApi.getProfile(uid);

    if(cancelled)return;

    if(existing){ setProfile(existing); } else { setModal('username'); }

   }catch{

    if(!cancelled) notify('Could not start your session. Refresh to try again.');

   }

  })();

  return ()=>{cancelled=true};

 },[]);

 useEffect(()=>{

  let cancelled=false;

  setSituationsLoading(true); setSituationsError('');

  gameApi.getSituations(userId)

   .then(data=>{ if(!cancelled) setSituations(data); })

   .catch(()=>{ if(!cancelled) setSituationsError('Could not load situations. Try refreshing.'); })

   .finally(()=>{ if(!cancelled) setSituationsLoading(false); });

  return ()=>{cancelled=true};

 },[userId]);

 const sorted=useMemo(()=>[...situations].sort((a,b)=>view==='trending'?b.hot-a.hot:b.advice.reduce((n,x)=>n+x.votes,0)-a.advice.reduce((n,x)=>n+x.votes,0)),[situations,view]); const filtered=topic==='All'?sorted:sorted.filter(s=>(topicTags[topic]||categories).includes(s.tag)); const pageCount=Math.max(1,Math.ceil(filtered.length/6)); const visible=filtered.slice((page-1)*6,page*6);

 const vote=async(sid:string, aid:string)=>{

  const target=situations.find(s=>s.id===sid)?.advice.find(a=>a.id===aid); if(!target||target.mine||!userId)return;

  try{

   await gameApi.castVote(aid,userId);

   setSituations(xs=>xs.map(s=>s.id!==sid?s:{...s,advice:s.advice.map(a=>a.id!==aid?a:{...a,votes:a.votes+1,mine:true}),hot:s.hot+1}));

   const next=await gameApi.addPoints(userId,1,profile.points); setProfile(p=>({...p,points:next}));

  }catch{ notify('Could not save your vote. Try again.'); }

 };

 const worsen=(s:Situation)=>{setSelected(s);setModal('advice')}; const openQuestion=()=>setModal('situation');

 const submitSituation=async(e:React.FormEvent<HTMLFormElement>)=>{

  e.preventDefault(); const f=new FormData(e.currentTarget); const title=String(f.get('title')).trim(),context=String(f.get('context')).trim();

  if(!gameApi.canPost('situation'))return notify('Easy, menace — wait 15 seconds before another post.');

  if(title.length<8||context.length<10)return notify('Give us a little more to work with.');

  if(!userId)return notify('Still setting up your session — try again in a moment.');

  gameApi.markPost('situation');

  try{

   const row=await gameApi.createSituation(userId,title,context,String(f.get('tag')));

   setSituations(xs=>[{id:row.id,title:row.title,context:row.context,tag:row.tag,author:profile.handle,time:row.time,advice:[],hot:0},...xs]);

   const next=await gameApi.addPoints(userId,10,profile.points); setProfile(p=>({...p,points:next}));

   setModal(null); notify('Situation posted. The internet is preparing its worst.');

  }catch{ notify('Could not post your situation. Try again.'); }

 };

 const submitAdvice=async(e:React.FormEvent<HTMLFormElement>)=>{

  e.preventDefault(); if(!selected)return; const text=String(new FormData(e.currentTarget).get('advice')).trim();

  if(!gameApi.canPost('advice'))return notify('Give the chaos a 15-second breather.');

  if(text.length<8)return notify('Make it worse than that.');

  if(!userId)return notify('Still setting up your session — try again in a moment.');

  gameApi.markPost('advice');

  try{

   const row=await gameApi.createAdvice(userId,selected.id,text);

   setSituations(xs=>xs.map(s=>s.id!==selected.id?s:{...s,advice:[{id:row.id,text:row.text,author:profile.handle,votes:0},...s.advice],hot:s.hot+7}));

   const next=await gameApi.addPoints(userId,5,profile.points); setProfile(p=>({...p,points:next}));

   setModal(null); notify('Terrible advice deployed. +5 menace points');

  }catch{ notify('Could not post your advice. Try again.'); }

 };

 const report=(sid:string,aid:string)=>{setSituations(xs=>xs.map(s=>s.id!==sid?s:{...s,advice:s.advice.map(a=>a.id===aid?{...a,reported:true}:a)}));notify('Reported for review. Thanks for keeping it unhinged, not harmful.');};

 const daily=situations.flatMap(s=>s.advice.map(a=>({...a,situation:s}))).sort((a,b)=>b.votes-a.votes)[0];

 const onAuth=(next:Profile)=>{setProfile(current=>({...next,points:current.email===next.email?current.points:0}));setModal(null);notify(`Welcome, ${next.name}. Your account is ready.`)};

 const saveUsername=async(name:string):Promise<string|null>=>{

  if(!userId)return 'Still setting up your session — try again in a moment.';

  try{

   const created=await gameApi.createProfile(userId,name);

   setProfile(created); setModal(null); notify(`Welcome, ${name}. Start earning points.`);

   return null;

  }catch(err:any){

   if(err?.code==='23505')return 'That name is taken — try another.';

   return 'Could not save your profile. Try again.';

  }

 };

 return <div className="app"><header><button className="brand" onClick={()=>setView('home')}>bro,<i>don’t.</i></button><div className="header-actions"><ThemeButton/></div></header>

 <main>{view==='home'&&<><Hero onAsk={openQuestion}/><section className="daily launch-card"><div><span>THE FLOOR IS OPEN</span><h2>No fake stories. Be the first real question.</h2><p>Ask something awkward, specific, or impossible. Real people will answer.</p></div><button className="launch-ask" onClick={openQuestion}>Ask now</button></section><HowItWorks onAsk={openQuestion}/><TopicDiscovery onSelectTopic={selectTopic}/></>}

 {view==='leaderboard'?<Leaderboard profile={profile}/>:<><div ref={feedRef} className="feed-head"><div><span className="eyebrow">{view==='trending'?'ON FIRE RIGHT NOW':'THE FEED'}</span><h2>{view==='trending'?'Trending disasters':'Fresh bad decisions'}</h2></div><TopicBar active={topic} onSelect={(next)=>{setTopic(next);setPage(1)}} situations={situations}/></div><div className="cards">{situationsLoading?<div className="empty-feed"><span>LOADING</span><h3>Fetching fresh disasters…</h3></div>:situationsError?<div className="empty-feed"><span>SOMETHING WENT WRONG</span><h3>{situationsError}</h3></div>:visible.length===0?<EmptyFeed onAsk={openQuestion}/>:visible.map(s=><SituationCard key={s.id} s={s} onVote={vote} onWorsen={worsen} onReport={report} notify={notify}/>)}</div><Pagination page={page} pageCount={pageCount} onChange={setPage}/><BottomCTA onAsk={openQuestion}/><Footer onNav={setView}/></>}

 </main><nav className="top-nav"><button className={view==='home'?'active':''} onClick={()=>setView('home')}><Home/><span>Home</span></button><button className={view==='trending'?'active':''} onClick={()=>setView('trending')}><Flame/><span>Trending</span></button><button className="create" onClick={openQuestion} aria-label="Ask a question"><Plus/></button><button className={view==='leaderboard'?'active':''} onClick={()=>setView('leaderboard')}><Trophy/><span>Ranks</span></button></nav>

 {modal==='username'?<UsernameModal onSave={saveUsername}/>:modal&&<Modal type={modal} close={()=>setModal(null)} selected={selected} profile={profile} setProfile={setProfile} onSituation={submitSituation} onAdvice={submitAdvice}/>} {toast&&<div className="toast">{toast}</div>}</div>

}

const HERO_PROMPTS=["I liked my ex's photo from 2019 by accident…","My roommate found out whose hair that is…","I said 'no worries,' but there are, in fact, worries…","I might text 'u up' at 1am again…","I told my boss I'd 'circle back' and never did…"];

function Hero({onAsk}:{onAsk:()=>void}){

 const [reduced]=useState(()=>typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);

 const [i,setI]=useState(0); const [sub,setSub]=useState(reduced?HERO_PROMPTS[0].length:0); const [deleting,setDeleting]=useState(false);

 useEffect(()=>{

  if(reduced)return;

  const full=HERO_PROMPTS[i]; const speed=deleting?22:38; const pause=deleting?300:1400;

  if(!deleting&&sub===full.length){const t=setTimeout(()=>setDeleting(true),pause);return()=>clearTimeout(t);}

  if(deleting&&sub===0){const t=setTimeout(()=>{setDeleting(false);setI(n=>(n+1)%HERO_PROMPTS.length)},200);return()=>clearTimeout(t);}

  const t=setTimeout(()=>setSub(n=>n+(deleting?-1:1)),speed);

  return()=>clearTimeout(t);

 },[sub,deleting,i,reduced]);

 const text=HERO_PROMPTS[i].slice(0,sub);

 return <section className="hero"><span className="eyebrow"><Sparkles/> BAD ADVICE, EXCEPTIONALLY DELIVERED</span><h1>Life is hard.<br/><em>Make it worse.</em></h1><p>Bring us your dilemma. Get the kind of advice your group chat would delete.</p><button className="hero-prompt" onClick={onAsk} aria-label="Ask a question"><span className="hero-prompt-text">{text}{!reduced&&<i className="hero-caret"/>}</span><span className="hero-prompt-go"><ArrowUp/></span></button></section>;

}

function SituationCard({s,onVote,onWorsen,onReport,notify}:{s:Situation,onVote:(s:string,a:string)=>void,onWorsen:(s:Situation)=>void,onReport:(s:string,a:string)=>void,notify:(x:string)=>void}){const [expanded,setExpanded]=useState(false);const advice=s.advice.slice(0,expanded?99:2);return <article className="card"><div className="meta"><span>{s.tag}</span><b>{s.author}</b><small>{s.time}</small><i>HOT {s.hot}</i></div><h3>{s.title}</h3><p className="context">{s.context}</p><div className="advice-list">{advice.map(a=><div className="advice" key={a.id}><button className={'vote '+(a.mine?'voted':'')} onClick={()=>onVote(s.id,a.id)} disabled={a.mine}><ArrowUp/>{a.votes}</button><div><p>“{a.text}”</p><small>{a.author}</small></div><button className="report" title="Report" onClick={()=>onReport(s.id,a.id)}><Flag size={15}/></button></div>)}</div><div className="card-foot"><button onClick={()=>onWorsen(s)}><Skull/> Make it worse</button>{s.advice.length>2&&<button onClick={()=>setExpanded(!expanded)}>{expanded?'Hide advice':`See all ${s.advice.length} takes`}</button>}<button onClick={()=>{navigator.clipboard?.writeText(`Bro, Don’t: ${s.title}\nWorst advice: ${s.advice[0]?.text||'pending'}`);notify('Share card copied to clipboard.')}}><Share2/> Share</button></div></article>}

function Leaderboard({profile}:{profile:Profile}){

 const [ranks,setRanks]=useState<{username:string;points:number}[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState('');

 useEffect(()=>{

  let cancelled=false;

  setLoading(true); setError('');

  gameApi.getLeaderboard()

   .then(data=>{ if(!cancelled) setRanks(data); })

   .catch(()=>{ if(!cancelled) setError('Could not load the leaderboard. Try refreshing.'); })

   .finally(()=>{ if(!cancelled) setLoading(false); });

  return ()=>{cancelled=true};

 },[]);

 return <section className="page"><span className="eyebrow"><Award/> THE HALL OF SHAME</span><h1>Menace leaderboard</h1><p className="sub">Points come from posting, voting, and making everyone’s day objectively worse.</p>{loading?<p className="sub">Loading ranks…</p>:error?<p className="sub">{error}</p>:<div className="rank-list">{ranks.map((r,i)=><div className="rank" key={r.username}><b>{i+1}</b><span className="rank-avatar">{r.username.trim().charAt(0).toUpperCase()||'M'}</span><strong>{'@'+r.username.toLowerCase().replace(/\s+/g,'')}</strong><em>{r.points} pts</em></div>)}</div>}<div className="rank me"><b>—</b><span className="rank-avatar">{profile.avatar}</span><strong>{profile.handle}</strong><em>{profile.points} pts</em></div></section>}

function ProfileLegacy({profile,onEdit}:{profile:Profile,onEdit:(n:string)=>void}){const [editing,setEditing]=useState(false);const [name,setName]=useState(profile.name);return <section className="page profile"><div className="profile-emoji">{profile.avatar}</div><span className="eyebrow">MEMBER SINCE {profile.joined.toUpperCase()}</span><h1>{profile.name}</h1><p>{profile.handle}</p><div className="stats"><div><b>{profile.points}</b><span>Menace pts</span></div><div><b>0</b><span>Advice posted</span></div><div><b>0</b><span>Wins</span></div></div>{editing?<form className="inline-form" onSubmit={e=>{e.preventDefault();onEdit(name);setEditing(false)}}><input value={name} onChange={e=>setName(e.target.value)}/><button>Save</button></form>:<button className="outline" onClick={()=>setEditing(true)}>Edit your alias</button>}<div className="profile-note"><Skull/><p>Post some truly reckless advice to start your legend.</p></div></section>}

function Profile({profile,onEdit}:{profile:Profile,onEdit:(n:string)=>void}){const [editing,setEditing]=useState(false);const [name,setName]=useState(profile.name);return <section className="page profile"><div className="profile-emoji">{profile.avatar}</div><span className="eyebrow">MEMBER SINCE {profile.joined.toUpperCase()}</span><h1>{profile.name}</h1><p>{profile.handle}</p>{profile.email&&<small className="account-email">Signed in as {profile.email}</small>}<div className="stats"><div><b>{profile.points}</b><span>Menace pts</span></div><div><b>0</b><span>Advice posted</span></div><div><b>0</b><span>Wins</span></div></div>{editing?<form className="inline-form" onSubmit={e=>{e.preventDefault();onEdit(name);setEditing(false)}}><input value={name} onChange={e=>setName(e.target.value)}/><button>Save</button></form>:<button className="outline" onClick={()=>setEditing(true)}>Edit your alias</button>}<div className="profile-note"><Skull/><p>Post some truly reckless advice to start your legend.</p></div></section>}

function ModalLegacy({type,close,selected,profile,setProfile,onSituation,onAdvice}:{type:'situation'|'advice'|'onboard';close:()=>void;selected:Situation|null;profile:Profile;setProfile:React.Dispatch<React.SetStateAction<Profile>>;onSituation:(e:React.FormEvent<HTMLFormElement>)=>void;onAdvice:(e:React.FormEvent<HTMLFormElement>)=>void}){const onboard=type==='onboard';return <div className="overlay"><div className="modal"><button className="close" onClick={close}><X/></button>{onboard?<form onSubmit={e=>{e.preventDefault();const name=String(new FormData(e.currentTarget).get('name')).trim()||'New menace';setProfile(p=>({...p,name,handle:'@'+name.toLowerCase().replace(/\s+/g,'')}));close()}}><span className="eyebrow">WELCOME TO THE BAD IDEA FACTORY</span><h2>First, what should we call you?</h2><p>Use a fake name. This is a place for questionable judgment.</p><input autoFocus name="name" maxLength={24} placeholder="e.g. Captain Regret"/><button className="primary full">Enter the chaos <ArrowUp/></button><small className="privacy">No email. No password. Your anonymous profile stays on this device.</small></form>:type==='situation'?<form onSubmit={onSituation}><span className="eyebrow">CONFESS</span><h2>What went wrong?</h2><label>Give it a headline<input autoFocus name="title" maxLength={100} placeholder="My neighbor saw me..." required/></label><label>Paint the regrettable picture<textarea name="context" maxLength={360} placeholder="The details make the bad advice better." required/></label><label>Category<select name="tag"><option>WORK</option><option>ROMANCE</option><option>FRIENDS</option><option>HOUSE</option><option>FAMILY</option><option>OTHER</option></select></label><button className="primary full">Ask the community <Send/></button></form>:<form onSubmit={onAdvice}><span className="eyebrow">MAKE IT WORSE</span><h2>{selected?.title}</h2><p>Useful advice is a violation of community spirit.</p><textarea autoFocus name="advice" maxLength={280} placeholder="Your most catastrophically unhelpful idea..." required/><button className="primary full">Submit terrible advice <Skull/></button></form>}</div></div>}

function Modal({type,close,selected,profile,setProfile,onSituation,onAdvice}:{type:'situation'|'advice'|'onboard';close:()=>void;selected:Situation|null;profile:Profile;setProfile:React.Dispatch<React.SetStateAction<Profile>>;onSituation:(e:React.FormEvent<HTMLFormElement>)=>void;onAdvice:(e:React.FormEvent<HTMLFormElement>)=>void}){
  const onboard=type==='onboard';
  const [categoryOpen,setCategoryOpen]=useState(false);
  const [otherOpen,setOtherOpen]=useState(false);
  const [selectedTopic,setSelectedTopic]=useState('Work');
  const [traffic,setTraffic]=useState<Record<string,number>>({});
  const categoryRef=useRef<HTMLDivElement>(null);

  const primaryTopics=['Love','Work','Friendship','Family','Dating','Money','College','Life','Wellness','Roommates'];
  const moreTopics=['Anxiety','Career switch','Coworkers','Breakups','Moving out','Fitness','Sleep','Travel','Pets','Food','Style','Gaming','Music','Movies','Books','Art','Photography','Social media','Dating apps','First date','Long distance','Marriage','Divorce','Parenting','Siblings','In-laws','Neighbors','Landlord','Rent','Bills','Debt','Saving','Investing','Side hustle','Startup','Freelance','Job interview','Burnout','Office politics','Remote work','Study tips','Exams','University','School','Teachers','Language','Confidence','Self-esteem','Habits','Productivity','Time management','Motivation','Meditation','Therapy','Health','Cooking','Home decor','Cleaning','Tech','Phones','Coding','AI','Privacy','Cars','Commuting','Sports','Fashion','Skincare','Hair','Weekend plans','Parties','Hosting','Gifts','Birthdays','Holidays','Culture','Faith','Identity','Community','Volunteering','Environment','News','Politics','Legal basics','Customer service','Small business','Networking','Public speaking','Creative block','Pet peeves','Apologies','Boundaries','Conflict','Jealousy','Trust','Loneliness','Grief','Big decisions','Life advice','Just venting'];

  const topicTagsForModal:Record<string,string>={
    Love:'ROMANCE',Work:'WORK',Friendship:'FRIENDS',Family:'FAMILY',Dating:'ROMANCE',Money:'WORK',College:'WORK',Life:'OTHER',Wellness:'OTHER',Roommates:'HOUSE',
    Anxiety:'OTHER','Career switch':'WORK',Coworkers:'WORK',Breakups:'ROMANCE','Moving out':'HOUSE',Fitness:'OTHER',Sleep:'OTHER',Travel:'OTHER',Pets:'OTHER',Food:'OTHER',Style:'OTHER',Gaming:'OTHER',Music:'OTHER',Movies:'OTHER',Books:'OTHER',Art:'OTHER',Photography:'OTHER','Social media':'OTHER','Dating apps':'ROMANCE','First date':'ROMANCE','Long distance':'ROMANCE',Marriage:'ROMANCE',Divorce:'ROMANCE',Parenting:'FAMILY',Siblings:'FAMILY','In-laws':'FAMILY',Neighbors:'HOUSE',Landlord:'HOUSE',Rent:'HOUSE',Bills:'WORK',Debt:'WORK',Saving:'WORK',Investing:'WORK','Side hustle':'WORK',Startup:'WORK',Freelance:'WORK','Job interview':'WORK',Burnout:'WORK','Office politics':'WORK','Remote work':'WORK','Study tips':'WORK',Exams:'WORK',University:'WORK',School:'WORK',Teachers:'WORK',Language:'OTHER',Confidence:'OTHER','Self-esteem':'OTHER',Habits:'OTHER',Productivity:'WORK','Time management':'WORK',Motivation:'OTHER',Meditation:'OTHER',Therapy:'OTHER',Health:'OTHER',Cooking:'OTHER','Home decor':'HOUSE',Cleaning:'HOUSE',Tech:'OTHER',Phones:'OTHER',Coding:'WORK',AI:'OTHER',Privacy:'OTHER',Cars:'OTHER',Commuting:'OTHER',Sports:'OTHER',Fashion:'OTHER',Skincare:'OTHER',Hair:'OTHER','Weekend plans':'OTHER',Parties:'OTHER',Hosting:'OTHER',Gifts:'OTHER',Birthdays:'OTHER',Holidays:'OTHER',Culture:'OTHER',Faith:'OTHER',Identity:'OTHER',Community:'FRIENDS',Volunteering:'OTHER',Environment:'OTHER',News:'OTHER',Politics:'OTHER','Legal basics':'OTHER','Customer service':'WORK','Small business':'WORK',Networking:'WORK','Public speaking':'WORK','Creative block':'OTHER','Pet peeves':'OTHER',Apologies:'OTHER',Boundaries:'OTHER',Conflict:'FRIENDS',Jealousy:'ROMANCE',Trust:'ROMANCE',Loneliness:'OTHER',Grief:'OTHER','Big decisions':'OTHER','Life advice':'OTHER','Just venting':'OTHER'
  };

  useEffect(()=>{
    if(type!=='situation')return;
    let cancelled=false;
    gameApi.getCategoryTraffic().then(counts=>{
      if(!cancelled)setTraffic(counts);
    }).catch(()=>{
      if(!cancelled)setTraffic({});
    });
    return()=>{cancelled=true};
  },[type]);

  const rankedPrimaryTopics=useMemo(()=>{
    return [...primaryTopics].sort((a,b)=>{
      const diff=(traffic[topicTagsForModal[b]]||0)-(traffic[topicTagsForModal[a]]||0);
      if(diff!==0)return diff;
      return primaryTopics.indexOf(a)-primaryTopics.indexOf(b);
    });
  },[traffic]);

  const topTopics=rankedPrimaryTopics.slice(0,5);
  const remainingTopics=[...rankedPrimaryTopics.slice(5),...moreTopics];

  useEffect(()=>{
    const handleClickOutside=(event:MouseEvent)=>{
      if(categoryRef.current&&!categoryRef.current.contains(event.target as Node)){
        setCategoryOpen(false);
        setOtherOpen(false);
      }
    };
    document.addEventListener('mousedown',handleClickOutside);
    return()=>document.removeEventListener('mousedown',handleClickOutside);
  },[]);

  return <div className="overlay"><div className="modal"><button className="close" onClick={close}><X/></button>{onboard?<form onSubmit={e=>{e.preventDefault();const name=String(new FormData(e.currentTarget).get('name')).trim()||'New menace';setProfile(p=>({...p,name,handle:'@'+name.toLowerCase().replace(/\s+/g,'')}));close()}}><span className="eyebrow">WELCOME TO THE BAD IDEA FACTORY</span><h2>First, what should we call you?</h2><p>Use a fake name. This is a place for questionable judgment.</p><input autoFocus name="name" maxLength={24} placeholder="e.g. Captain Regret"/><button className="primary full">Enter the chaos <ArrowUp/></button><small className="privacy">You can create a login at any time from the top-right corner.</small></form>:type==='situation'?<form onSubmit={onSituation}><span className="eyebrow">CONFESS</span><h2>What went wrong?</h2><label>Give it a headline<input autoFocus name="title" maxLength={100} placeholder="My neighbor saw me..." required/></label><label>Paint the regrettable picture<textarea name="context" maxLength={360} placeholder="The details make the bad advice better." required/></label><label>Category<div className="modal-category-select" ref={categoryRef}><button type="button" className="category-display" onClick={()=>setCategoryOpen(!categoryOpen)}><span>{selectedTopic}</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg></button>{categoryOpen&&<div className="category-dropdown"><div className="category-list">{topTopics.map(topic=><button key={topic} type="button" className={`category-option ${selectedTopic===topic?'selected':''}`} onClick={()=>{setSelectedTopic(topic);setCategoryOpen(false);setOtherOpen(false);}}>{topic}</button>)}<button type="button" className={`category-option ${otherOpen?'selected':''}`} onClick={()=>setOtherOpen(!otherOpen)}>Other {otherOpen?'−':'+'}</button>{otherOpen&&<div className="category-list">{remainingTopics.map(topic=><button key={topic} type="button" className={`category-option ${selectedTopic===topic?'selected':''}`} onClick={()=>{setSelectedTopic(topic);setCategoryOpen(false);setOtherOpen(false);}}>{topic}</button>)}</div>}</div></div>}<input type="hidden" name="tag" value={topicTagsForModal[selectedTopic]||'OTHER'}/></div></label><button className="primary full">Ask the community <Send/></button></form>:<form onSubmit={onAdvice}><span className="eyebrow">MAKE IT WORSE</span><h2>{selected?.title}</h2><p>Useful advice is a violation of community spirit.</p><textarea autoFocus name="advice" maxLength={280} placeholder="Your most catastrophically unhelpful idea..." required/><button className="primary full">Submit terrible advice <Skull/></button></form>}</div></div>
}

function HowItWorks({onAsk}:{onAsk:()=>void}){return <section className="how-it-works"><div><span className="eyebrow">HOW THIS WORKS</span><h2>Come for the question.<br/>Stay for the answers.</h2></div><div className="steps"><article><b>01</b><h3>Ask honestly</h3><p>Put the real situation into words. The more specific it is, the better the replies.</p></article><article><b>02</b><h3>Read the room</h3><p>Browse conversations by topic, then vote for the answers that actually land.</p></article><article><b>03</b><h3>Keep it moving</h3><p>Reply when you have something useful, funny, or brutally clear to add.</p></article></div><button className="outline" onClick={onAsk}>Start a conversation</button></section>}

function EmptyFeed({onAsk}:{onAsk:()=>void}){return <section className="empty-feed"><span>FIRST POST ENERGY</span><h3>No questions in this topic yet.</h3><p>That is not a dead end. It is an invitation.</p><button className="primary" onClick={onAsk}>Ask the first question <ArrowUp/></button></section>}

function UsernameModal({onSave}:{onSave:(name:string)=>Promise<string|null>}){const [error,setError]=useState(''); const [submitting,setSubmitting]=useState(false); return <div className="overlay"><section className="modal username-modal"><span className="eyebrow">WELCOME IN</span><h2>What should we call you?</h2><p>Pick a name once. Your questions, answers, and points stay connected to it on this browser.</p><form onSubmit={async e=>{e.preventDefault();const name=String(new FormData(e.currentTarget).get('username')).trim();if(name.length<2||name.length>24){setError('Use 2–24 characters.');return}setSubmitting(true);const err=await onSave(name);setSubmitting(false);if(err)setError(err);}}><label>Username<input autoFocus name="username" maxLength={24} placeholder="Puj.exe" required/></label>{error&&<p className="form-error">{error}</p>}<button className="primary full" disabled={submitting}>Start answering <ArrowUp/></button></form><small className="privacy">No email, password, or sign-in required.</small></section></div>}

function ThemeButton(){const [dark,setDark]=useState(localStorage.getItem('bro-dont-theme')==='dark');useEffect(()=>{document.documentElement.dataset.theme=dark?'dark':'light';localStorage.setItem('bro-dont-theme',dark?'dark':'light')},[dark]);return <button className="theme-toggle" onClick={()=>setDark(!dark)} aria-label="Toggle dark mode">{dark?<Sun/>:<Moon/>}</button>}

function TopicBar({active,onSelect,situations}:{active:string;onSelect:(topic:string)=>void;situations:Situation[]}){
  const [more,setMore]=useState(false);

  const topics=['All','Love','Work','Friendship','Family','Dating','Money','College','Wellness','Roommates'];
  const moreTopics=['Anxiety','Career switch','Coworkers','Breakups','Moving out','Fitness','Sleep','Travel','Pets','Food','Style','Gaming','Music','Movies','Books','Art','Photography','Social media','Dating apps','First date','Long distance','Marriage','Divorce','Parenting','Siblings','In-laws','Neighbors','Landlord','Rent','Bills','Debt','Saving','Investing','Side hustle','Startup','Freelance','Job interview','Burnout','Office politics','Remote work','Study tips','Exams','University','School','Teachers','Language','Confidence','Self-esteem','Habits','Productivity','Time management','Motivation','Meditation','Therapy','Health','Cooking','Home decor','Cleaning','Tech','Phones','Coding','AI','Privacy','Cars','Commuting','Sports','Fashion','Skincare','Hair','Weekend plans','Parties','Hosting','Gifts','Birthdays','Holidays','Culture','Faith','Identity','Community','Volunteering','Environment','News','Politics','Legal basics','Customer service','Small business','Networking','Public speaking','Creative block','Pet peeves','Apologies','Boundaries','Conflict','Jealousy','Trust','Loneliness','Grief','Big decisions','Life advice','Just venting'];

  const traffic=useMemo(()=>{
    const counts:Record<string,number>={};
    situations.forEach(s=>{
      if(s.tag) counts[s.tag]=(counts[s.tag]||0)+1;
    });
    return counts;
  },[situations]);

  const rankedTopics=useMemo(()=>{
    return topics
      .slice(1)
      .sort((a,b)=>{
        const aTags=topicTags[a]||[];
        const bTags=topicTags[b]||[];
        const aCount=aTags.reduce((n,tag)=>n+(traffic[tag]||0),0);
        const bCount=bTags.reduce((n,tag)=>n+(traffic[tag]||0),0);
        if(bCount!==aCount)return bCount-aCount;
        return topics.indexOf(a)-topics.indexOf(b);
      })
      .slice(0,5);
  },[traffic]);

  const visibleTopics=['All',...rankedTopics];

  const remainingTopics=[
    ...topics.slice(1).filter(topic=>!rankedTopics.includes(topic)),
    ...moreTopics.filter(topic=>!topics.includes(topic))
  ];

  return <div className="topic-wrap">
    <div className="topic-bar" aria-label="Browse topics">
      {visibleTopics.map(topic=><button key={topic} className={active===topic?'selected':''} onClick={()=>onSelect(topic)}>{topic}</button>)}
      <button className={more?'selected more-trigger':'more-trigger'} onClick={()=>setMore(!more)}>
        Other {more?'−':'+'}
      </button>
    </div>
    {more&&<div className="more-topics">
      <div className="more-topics-head">
        <b>More topics</b>
        <span>{remainingTopics.length} ways to start a conversation</span>
      </div>
      <div className="more-topic-grid">
        {remainingTopics.map(topic=><button key={topic} className={active===topic?'selected':''} onClick={()=>{onSelect(topic);setMore(false)}}>{topic}</button>)}
      </div>
    </div>}
  </div>
}


function TopicDiscovery({onSelectTopic}:{onSelectTopic:(topic:string)=>void}){

 const topics=[

  {label:'Love',desc:'Bad texts. Worse decisions.',key:'Love'},

  {label:'Work',desc:'Coworkers, bosses & questionable career moves.',key:'Work'},

  {label:'Friendship',desc:'Because talking it out sounds exhausting.',key:'Friendship'},

  {label:'Family',desc:'The holidays are coming to an end.',key:'Family'},

  {label:'Dating',desc:'Things that should have been left alone.',key:'Dating'},

  {label:'Money',desc:'Financial decisions you already regret.',key:'Money'},

  {label:'College',desc:'Academic pressures & life choices.',key:'College'},

  {label:'Life',desc:'The daily grind meets disaster.',key:'Life'},

 ];

 return <section className="topic-discovery">

  <div className="topic-head">

   <span className="eyebrow">WHAT ARE YOU DEALING WITH</span>

   <h2>What are you dealing with?</h2>

   <p className="topic-sub">Pick your flavor of chaos.</p>

  </div>

  <div className="topic-grid">

   {topics.map(t=>(

    <button key={t.key} className="topic-card" onClick={()=>{onSelectTopic(t.label)}}>

     <b>{t.label}</b>

     <p>{t.desc}</p>

    </button>

   ))}

  </div>

 </section>;

}

function Pagination({page,pageCount,onChange}:{page:number;pageCount:number;onChange:(page:number)=>void}){if(pageCount<2)return null;return <nav className="pagination" aria-label="Question pages">{Array.from({length:pageCount},(_,i)=>i+1).map(n=><button key={n} className={page===n?'current':''} onClick={()=>onChange(n)}>{n}</button>)}</nav>}

function BottomCTA({onAsk}:{onAsk:()=>void}){return <section className="bottom-cta"><div className="cta-inner"><div className="cta-copy"><span className="eyebrow"><Skull/> GOT A TERRIBLE SITUATION?</span><h2>Don't solve it alone.</h2><p>Post your situation and let the internet make it worse.</p></div><button className="primary" onClick={onAsk}>Ask a question <ArrowUp/></button></div></section>}

function Footer({onNav}:{onNav:(view:'home'|'trending'|'leaderboard')=>void}){return <footer className="site-footer"><div className="footer-left"><div className="footer-brand">bro,<i>don’t.</i></div><p className="footer-tag">Ask bad questions.<br/>Give worse answers.</p></div><div className="footer-right"><nav className="footer-links"><button onClick={()=>onNav('home')}>Home</button><button onClick={()=>onNav('trending')}>Trending</button><button onClick={()=>onNav('leaderboard')}>Ranks</button></nav><small className="footer-copy">© 2026 Bro, Don’t.</small></div></footer>}

function SettingsPanel({close}:{close:()=>void}){

 const [dark,setDark]=useState(localStorage.getItem('bro-dont-theme')==='dark');

 const [compact,setCompact]=useState(localStorage.getItem('bro-dont-density')==='compact');

 const [motion,setMotion]=useState(localStorage.getItem('bro-dont-motion')!=='off');

 const [notifications,setNotifications]=useState(localStorage.getItem('bro-dont-notifications')==='on');

 useEffect(()=>{document.documentElement.dataset.theme=dark?'dark':'light';localStorage.setItem('bro-dont-theme',dark?'dark':'light')},[dark]);

 useEffect(()=>{document.documentElement.dataset.density=compact?'compact':'comfortable';localStorage.setItem('bro-dont-density',compact?'compact':'comfortable')},[compact]);

 useEffect(()=>{document.documentElement.dataset.motion=motion?'on':'off';localStorage.setItem('bro-dont-motion',motion?'on':'off')},[motion]);

 useEffect(()=>localStorage.setItem('bro-dont-notifications',notifications?'on':'off'),[notifications]);

 const Row=({icon,label,copy,on,value}:{icon:React.ReactNode;label:string;copy:string;on:()=>void;value:boolean})=><button className="setting-row" onClick={on}><span className="setting-icon">{icon}</span><span><b>{label}</b><small>{copy}</small></span><span className={'switch '+(value?'on':'')}><i/></span></button>;

 return <div className="overlay"><section className="modal settings-modal"><button className="close" onClick={close}><X/></button><span className="eyebrow"><Settings/> PERSONALIZE</span><h2>Settings</h2><p>Make Bro, Don’t feel like your corner of the internet.</p><div className="settings-group"><Row icon={dark?<Moon/>:<Sun/>} label="Dark mode" copy="Easy on the eyes after midnight." value={dark} on={()=>setDark(!dark)}/><Row icon={<Eye/>} label="Compact feed" copy="Fit more questions on screen." value={compact} on={()=>setCompact(!compact)}/><Row icon={<Sparkles/>} label="Motion" copy="Keep interface animations on." value={motion} on={()=>setMotion(!motion)}/><Row icon={<Bell/>} label="Reply alerts" copy="Get notified about new advice." value={notifications} on={()=>setNotifications(!notifications)}/></div><div className="settings-tip"><b>Quick tip</b><span>Press the + button any time to ask a question. It is always one tap away.</span></div></section></div>

}

createRoot(document.getElementById('root')!).render(<App/>);