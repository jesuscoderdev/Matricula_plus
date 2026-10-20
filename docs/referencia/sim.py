import random, math, statistics as st
def run(seed=1, newschool=False, jornada=False, mech="da", wdist=1.0, whno=0.0):
    R=random.Random(seed)
    # 40 schools on 10x10 km grid; 'deficit zone' NW corner has dense demand
    schools=[(R.uniform(0,10),R.uniform(0,10)) for _ in range(40)]
    N=4000
    fam=[]
    for i in range(N):
        if R.random()<0.35: x,y=R.uniform(0,3),R.uniform(7,10)  # zona deficitaria
        else: x,y=R.uniform(0,10),R.uniform(0,10)
        fam.append((x,y,R.random()<0.15, R.random()<0.3))  # hermano, vulnerable
    cap_total=int(N*0.883)  # 140.377/158.957
    caps=[cap_total//40]*40
    if newschool:
        schools.append((1.5,8.5)); caps.append(300)
    if jornada:
        caps=[int(c*0.9) for c in caps]
    sib=[R.randrange(len(schools)) for _ in range(N)]
    prefs=[]
    for (x,y,h,v),s in zip(fam,sib):
        d=sorted(range(len(schools)),key=lambda j:math.dist((x,y),schools[j])+R.uniform(0,1.5))
        p=d[:3]
        if h and s not in p: p=[s]+p[:2]
        prefs.append(p)
    tie=[R.random() for _ in range(N)]
    def score(i,j):
        x,y,h,v=fam[i]
        return -wdist*math.dist((x,y),schools[j]) + (5 if (h and sib[i]==j) else 0) + whno*(3 if v else 0) + tie[i]*0.01
    assign=[None]*N
    if mech=="fcfs":
        order=list(range(N)); R.shuffle(order); left=caps[:]
        for i in order:
            for j in prefs[i]:
                if left[j]>0: left[j]-=1; assign[i]=j; break
    else:
        nxt=[0]*N; held={j:[] for j in range(len(schools))}; free=list(range(N))
        while free:
            i=free.pop()
            if nxt[i]>=3: continue
            j=prefs[i][nxt[i]]; nxt[i]+=1
            held[j].append(i); held[j].sort(key=lambda k:-score(k,j))
            if len(held[j])>caps[j]:
                free.append(held[j].pop())
        for j,l in held.items():
            for i in l: assign[i]=j
    first=sum(1 for i in range(N) if assign[i]==prefs[i][0])/N
    none=sum(1 for a in assign if a is None)
    dist=st.mean(math.dist(fam[i][:2],schools[assign[i]]) for i in range(N) if assign[i] is not None)
    zone=[i for i in range(N) if fam[i][0]<3 and fam[i][1]>7]
    nz=sum(1 for i in zone if assign[i] is None)/len(zone)
    vul=[i for i in range(N) if fam[i][3]]; nv=sum(1 for i in vul if assign[i] is None)/len(vul)
    return first,none/N,dist,nz,nv
def avg(**k):
    rs=[run(seed=s,**k) for s in range(20)]
    return [st.mean(r[t] for r in rs) for t in range(5)]
for name,k in [("Orden de llegada",dict(mech="fcfs")),("Asignación diferida (cercanía+hermanos)",{}),
  ("DA + prioridad vulnerabilidad",dict(whno=1)),("DA + colegio nuevo zona crítica",dict(newschool=True)),
  ("DA + jornada única (-10% cap)",dict(jornada=True))]:
    f,n,d,nz,nv=avg(**k); print(f"{name:42s} 1ra:{f*100:5.1f}% sin:{n*100:5.1f}% dist:{d:4.2f}km sinZona:{nz*100:5.1f}% sinVul:{nv*100:5.1f}%")
