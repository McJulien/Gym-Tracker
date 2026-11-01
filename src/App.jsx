import{useEffect,useState,useCallback}from'react'
import{createClient}from'@supabase/supabase-js'
const sb=createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_ANON_KEY)
const MUSCLES=['Pecho','Espalda','Hombro','Bíceps','Tríceps','Cuádriceps','Femoral','Glúteo','Pantorrilla','Abdomen','Antebrazo']
const TYPES={weight:'Con peso',bodyweight:'Peso corporal',time:'Tiempo'}
const LB=2.20462
const today=()=>new Date(Date.now()-new Date().getTimezoneOffset()*6e4).toISOString().slice(0,10)

export default function App(){
  const[s,setS]=useState(null),[ok,setOk]=useState(false)
  useEffect(()=>{
    sb.auth.getSession().then(({data})=>{setS(data.session);setOk(true)})
    const{data}=sb.auth.onAuthStateChange((_,x)=>setS(x))
    return()=>data.subscription.unsubscribe()
  },[])
  if(!ok)return null
  return s?<Main uid={s.user.id}/>:<Auth/>
}

function Auth(){
  const[e,setE]=useState(''),[p,setP]=useState(''),[m,setM]=useState(''),[up,setUp]=useState(false)
  const go=async()=>{
    const r=up?await sb.auth.signUp({email:e,password:p}):await sb.auth.signInWithPassword({email:e,password:p})
    if(r.error)setM(r.error.message);else if(up&&!r.data.session)setM('Revisa tu correo para confirmar la cuenta')
  }
  return<div className="w"><h2>Gym Tracker</h2>
    <div className="row"><input type="email" placeholder="Correo" value={e} onChange={x=>setE(x.target.value)}/></div>
    <div className="row"><input type="password" placeholder="Contraseña (mín. 6)" value={p} onChange={x=>setP(x.target.value)}/></div>
    <div className="row"><button className="p" onClick={go}>{up?'Crear cuenta':'Entrar'}</button>
    <button onClick={()=>setUp(!up)}>{up?'Ya tengo cuenta':'Registrarme'}</button></div><small>{m}</small></div>
}

function Main({uid}){
  const[tab,setTab]=useState('train'),[unit,setUnit]=useState(localStorage.unit||'kg')
  const[ex,setEx]=useState([]),[rt,setRt]=useState([]),[re,setRe]=useState([])
  const load=useCallback(async()=>{
    const[a,b,c]=await Promise.all([
      sb.from('exercises').select('*').eq('archived',false).order('name'),
      sb.from('routines').select('*').order('name'),
      sb.from('routine_exercises').select('*').order('position')])
    setEx(a.data||[]);setRt(b.data||[]);setRe(c.data||[])
  },[])
  useEffect(()=>{load()},[load])
  const u={unit,show:kg=>kg===''||kg==null?'':unit==='lb'?Math.round(kg*LB*10)/10:Math.round(kg*100)/100,kg:v=>unit==='lb'?v/LB:+v}
  const flip=()=>{const n=unit==='kg'?'lb':'kg';localStorage.unit=n;setUnit(n)}
  const P={ex,rt,re,u,uid,load}
  const T=[['train','Entrenar'],['routines','Rutinas'],['lib','Biblioteca'],['prog','Progreso']]
  return<><div className="w">
    <div className="row"><h2 style={{flex:1}}>{T.find(t=>t[0]===tab)[1]}</h2>
      <button onClick={flip}>{unit}</button><button onClick={()=>sb.auth.signOut()}>Salir</button></div>
    {tab==='train'&&<Train {...P}/>}{tab==='routines'&&<Routines {...P}/>}
    {tab==='lib'&&<Library {...P}/>}{tab==='prog'&&<Progress {...P}/>}</div>
    <nav>{T.map(([k,l])=><button key={k} className={tab===k?'on':''} onClick={()=>setTab(k)}>{l}</button>)}</nav></>
}

function Library({ex,load,uid}){
  const blank={name:'',primary_muscle:'Pecho',secondary:'',type:'weight',video_url:''}
  const[f,setF]=useState(blank),[q,setQ]=useState('')
  const set=k=>x=>setF({...f,[k]:x.target.value})
  const add=async()=>{
    if(!f.name.trim())return
    await sb.from('exercises').insert({user_id:uid,name:f.name.trim(),primary_muscle:f.primary_muscle,
      secondary:f.secondary.split(',').map(x=>x.trim()).filter(Boolean),type:f.type,video_url:f.video_url||null})
    setF(blank);load()
  }
  const video=async e=>{const v=prompt('Link del video (YouTube):',e.video_url||'');if(v!==null){await sb.from('exercises').update({video_url:v||null}).eq('id',e.id);load()}}
  const arch=async e=>{if(confirm('¿Archivar '+e.name+'? El historial se conserva.')){await sb.from('exercises').update({archived:true}).eq('id',e.id);load()}}
  return<><div className="card"><h3>Nuevo ejercicio</h3>
    <div className="row"><input placeholder="Nombre" value={f.name} onChange={set('name')}/></div>
    <div className="row"><select value={f.primary_muscle} onChange={set('primary_muscle')}>{MUSCLES.map(m=><option key={m}>{m}</option>)}</select>
      <select value={f.type} onChange={set('type')}>{Object.entries(TYPES).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
    <div className="row"><input placeholder="Secundarios (separados por coma)" value={f.secondary} onChange={set('secondary')}/></div>
    <div className="row"><input placeholder="Link de video (opcional)" value={f.video_url} onChange={set('video_url')}/></div>
    <button className="p" onClick={add}>Agregar</button></div>
    <div className="row"><input placeholder="Buscar..." value={q} onChange={x=>setQ(x.target.value)}/></div>
    {ex.filter(e=>(e.name+e.primary_muscle).toLowerCase().includes(q.toLowerCase())).map(e=><div className="card" key={e.id}>
      <b>{e.name}</b> <small>· {TYPES[e.type]}</small><br/>
      <small>{e.primary_muscle}{e.secondary?.length?' + '+e.secondary.join(', '):''}</small>
      <div className="row">{e.video_url&&<a href={e.video_url} target="_blank" rel="noreferrer">▶ Video</a>}
        <button onClick={()=>video(e)}>Video</button><button onClick={()=>arch(e)}>Archivar</button></div></div>)}</>
}

function Routines({ex,rt,re,load,uid}){
  const[n,setN]=useState(''),[sel,setSel]=useState('')
  const items=re.filter(x=>x.routine_id===sel)
  const create=async()=>{if(!n.trim())return;const{data}=await sb.from('routines').insert({user_id:uid,name:n.trim()}).select().single();setN('');await load();setSel(data.id)}
  const addEx=async id=>{if(id){await sb.from('routine_exercises').insert({user_id:uid,routine_id:sel,exercise_id:id,position:items.length});load()}}
  const rm=async id=>{await sb.from('routine_exercises').delete().eq('id',id);load()}
  const delR=async()=>{if(confirm('¿Eliminar rutina?')){await sb.from('routines').delete().eq('id',sel);setSel('');load()}}
  const muscles=[...new Set(items.map(i=>ex.find(e=>e.id===i.exercise_id)?.primary_muscle).filter(Boolean))]
  return<><div className="row"><input placeholder="Nueva rutina (Push, Pierna...)" value={n} onChange={x=>setN(x.target.value)}/><button className="p" onClick={create}>Crear</button></div>
    <div className="row"><select value={sel} onChange={x=>setSel(x.target.value)}><option value="">Elige una rutina</option>{rt.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select>
      {sel&&<button onClick={delR}>Eliminar</button>}</div>
    {sel&&<div className="card"><small>Trabaja: {muscles.join(', ')||'—'}</small>
      {items.map(i=><div className="row" key={i.id}><span style={{flex:1}}>{ex.find(e=>e.id===i.exercise_id)?.name}</span><button onClick={()=>rm(i.id)}>×</button></div>)}
      <select value="" onChange={x=>addEx(x.target.value)}><option value="">+ Añadir ejercicio</option>{ex.map(e=><option key={e.id} value={e.id}>{e.name} ({e.primary_muscle})</option>)}</select></div>}</>
}

function Train({ex,rt,re,u,uid}){
  const[w,setW]=useState(null),[rid,setRid]=useState(''),[date,setDate]=useState(today()),[notes,setNotes]=useState('')
  const blank={reps:'',w:'',sec:'',rest:0,warmup:false}
  const mk=async e=>{
    const{data}=await sb.from('sets').select('*').eq('exercise_id',e.id).order('created_at',{ascending:false}).limit(40)
    const first=data?.[0]?.session_id
    const p=(data||[]).filter(x=>x.session_id===first).sort((a,b)=>a.position-b.position)
    return{ex:e,sets:p.length?p.map(x=>({reps:x.reps??'',w:x.weight_kg??'',sec:x.seconds??'',rest:x.rest_s??0,warmup:x.warmup})):[blank]}
  }
  const start=async()=>setW(await Promise.all(re.filter(x=>x.routine_id===rid).map(x=>ex.find(e=>e.id===x.exercise_id)).filter(Boolean).map(mk)))
  const addEx=async id=>{if(id)setW([...w,await mk(ex.find(e=>e.id===id))])}
  const up=(i,j,k,v)=>setW(w.map((e,a)=>a!==i?e:{...e,sets:e.sets.map((s,b)=>b!==j?s:{...s,[k]:v})}))
  const addSet=i=>setW(w.map((e,a)=>a!==i?e:{...e,sets:[...e.sets,{...(e.sets.at(-1)||blank),warmup:false}]}))
  const delSet=(i,j)=>setW(w.map((e,a)=>a!==i?e:{...e,sets:e.sets.filter((_,b)=>b!==j)}))
  const save=async()=>{
    const{data:s,error}=await sb.from('sessions').insert({user_id:uid,routine_id:rid||null,date,notes}).select().single()
    if(error)return alert(error.message)
    const rows=w.flatMap(e=>e.sets.map((x,i)=>({user_id:uid,session_id:s.id,exercise_id:e.ex.id,position:i,
      reps:x.reps===''?null:+x.reps,weight_kg:x.w===''?null:x.w,seconds:x.sec===''?null:+x.sec,rest_s:+x.rest||null,warmup:x.warmup})))
    const r=await sb.from('sets').insert(rows);if(r.error)return alert(r.error.message)
    setW(null);setNotes('');alert('Sesión guardada')
  }
  if(!w)return<><div className="row"><select value={rid} onChange={x=>setRid(x.target.value)}><option value="">Sesión libre</option>{rt.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select>
    <input type="date" value={date} onChange={x=>setDate(x.target.value)}/></div><button className="p" onClick={start}>Empezar</button></>
  return<>{w.map((e,i)=><div className="card" key={i}><b>{e.ex.name}</b> <small>{e.ex.primary_muscle}</small>
    {e.sets.map((s,j)=><div className="row" key={j}><small>{j+1}</small>
      {e.ex.type!=='time'&&<input type="number" inputMode="numeric" placeholder="reps" value={s.reps} onChange={x=>up(i,j,'reps',x.target.value)}/>}
      {e.ex.type!=='time'&&<input type="number" inputMode="decimal" placeholder={u.unit} value={u.show(s.w)} onChange={x=>up(i,j,'w',x.target.value===''?'':u.kg(x.target.value))}/>}
      {e.ex.type==='time'&&<input type="number" inputMode="numeric" placeholder="seg" value={s.sec} onChange={x=>up(i,j,'sec',x.target.value)}/>}
      <select value={s.rest} onChange={x=>up(i,j,'rest',x.target.value)}>{[0,60,90,120,180].map(r=><option key={r} value={r}>{r?r+'s':'desc.'}</option>)}</select>
      <label><input type="checkbox" checked={s.warmup} onChange={x=>up(i,j,'warmup',x.target.checked)}/><small>Cal.</small></label>
      <button onClick={()=>delSet(i,j)}>×</button></div>)}
    <button onClick={()=>addSet(i)}>+ serie</button></div>)}
    <select value="" onChange={x=>addEx(x.target.value)}><option value="">+ Añadir ejercicio</option>{ex.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select>
    <div className="row"><input placeholder="Notas de la sesión" value={notes} onChange={x=>setNotes(x.target.value)}/></div>
    <div className="row"><button className="p" onClick={save}>Guardar sesión</button><button onClick={()=>setW(null)}>Cancelar</button></div></>
}

function Progress({ex,u}){
  const[id,setId]=useState(''),[d,setD]=useState([])
  useEffect(()=>{if(id)sb.from('sets').select('*,sessions(date)').eq('exercise_id',id).eq('warmup',false).then(({data})=>setD(data||[]))},[id])
  const e=ex.find(x=>x.id===id),g={};let rm=0,mx=0
  if(e)d.forEach(s=>{
    const k=s.sessions.date,wk=s.weight_kg||0;g[k]=g[k]||{vol:0,max:0}
    g[k].vol+=e.type==='time'?(s.seconds||0):(s.reps||0)*(e.type==='weight'?wk:1)
    g[k].max=Math.max(g[k].max,wk);mx=Math.max(mx,wk);rm=Math.max(rm,wk*(1+(s.reps||0)/30))
  })
  const rows=Object.entries(g).sort().slice(-12),top=Math.max(1,...rows.map(r=>r[1].vol))
  return<><select value={id} onChange={x=>setId(x.target.value)}><option value="">Elige un ejercicio</option>{ex.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select>
    {e&&(rows.length?<div className="card"><small>Volumen por sesión (solo series efectivas)</small>
      <div className="bars">{rows.map(([k,r])=><div key={k} title={k} style={{height:r.vol/top*100+'%'}}/>)}</div>
      {e.type==='weight'&&<p>🏆 PR peso: <b>{u.show(mx)} {u.unit}</b> · 1RM est.: <b>{u.show(rm)} {u.unit}</b></p>}
      {rows.slice().reverse().map(([k,r])=><div className="row" key={k}><small style={{flex:1}}>{k}</small>
        <span>Vol {u.show(r.vol)}</span>{e.type==='weight'&&<span>Máx {u.show(r.max)} {u.unit}</span>}</div>)}</div>:<p><small>Aún no hay sesiones con este ejercicio.</small></p>)}</>
}
