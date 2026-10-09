
(() => {
'use strict';
const D={
  taxYear:'2026/27',
  pa:12570, paTaper:100000, blind:3250,
  rukBands:[[37700,.20],[87440,.40],[Infinity,.45]],
  scotBands:[[3967,.19],[12989,.20],[14136,.21],[31338,.42],[62710,.45],[Infinity,.48]],
  ni:{pt:12570,uel:50270,main:.08,upper:.02},
  employerNI:{st:5000,rate:.15},
  class4:{lower:12570,upper:50270,main:.06,upperRate:.02},
  dividend:{allowance:500,basic:.1075,higher:.3575,additional:.3935},
  savings:{starting:5000,psaBasic:1000,psaHigher:500},
  student:{p1:[26900,.09],p2:[29385,.09],p4:[33795,.09],p5:[25000,.09],pg:[21000,.06]},
  corp:{lower:50000,upper:250000,small:.19,main:.25,fraction:3/200},
  vat:{standard:.20,reduced:.05,registration:90000,deregistration:88000},
  cgt:{allowance:3000,basic:.18,higher:.24},
  pension:{annual:60000,thresholdIncome:200000,adjustedIncome:260000,min:10000,mpaa:10000},
  childBenefit:{first:27.05,other:17.90,start:60000,end:80000},
  marriage:{transfer:1260,saving:252},
  minimumWage:{adult21:12.71,age18to20:10.85,under18:8,apprentice:8},
  propertyAllowance:1000,tradingAllowance:1000,rentRoom:7500,
  iht:{nrb:325000,rnrb:175000,taperStart:2000000,rate:.40,charityRate:.36},
  expenses:{car:.55,carAfter:.25,carLimit:10000,motorcycle:.24,home:[[101,26],[51,18],[25,10]],premises:[350,500,650]}
};
const money=n=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:2}).format(Number.isFinite(n)?n:0);
const pct=n=>`${(n*100).toFixed(2).replace(/\.00$/,'')}%`;
const clamp=(n,min=0,max=Infinity)=>Math.min(max,Math.max(min,+n||0));
const round2=n=>Math.round(Math.round(n*1e6)/1e4)/100;
const annualise=(v,f)=>f==='month'?v*12:f==='week'?v*52:v;
function allowance(income,blind=false){let a=Math.max(0,D.pa-Math.max(0,income-D.paTaper)/2);if(blind)a+=D.blind;return a}
function parseCode(raw,region='ruk'){
  if(!raw)return null;
  let original=String(raw).trim().toUpperCase().replace(/\s+/g,''),code=original.replace(/(W1|M1|X|NONCUM)$/,'');
  let emergency=code!==original,bands=region==='scotland'?'scotland':'ruk',regionLabel=region==='scotland'?'Scotland':'England, Wales or Northern Ireland';
  if(code.startsWith('S')){code=code.slice(1);bands='scotland';regionLabel='Scotland (S prefix)'}
  else if(code.startsWith('C')){code=code.slice(1);bands='ruk';regionLabel='Wales (C prefix)'}
  const base={emergency,region:bands,regionLabel};
  if(code==='NT')return{...base,type:'nt',allowance:Infinity,label:'No tax code'};
  if(code==='BR')return{...base,type:'flat',rate:.20,label:'Basic rate on all pay'};
  const flat=bands==='scotland'?{D0:[.21,'Scottish intermediate rate on all pay'],D1:[.42,'Scottish higher rate on all pay'],D2:[.45,'Scottish advanced rate on all pay'],D3:[.48,'Scottish top rate on all pay']}:{D0:[.40,'Higher rate on all pay'],D1:[.45,'Additional rate on all pay']};
  if(flat[code])return{...base,type:'flat',rate:flat[code][0],label:flat[code][1]};
  if(code==='0T')return{...base,type:'bands',allowance:0,label:'No Personal Allowance'};
  let km=code.match(/^K(\d+)$/);if(km)return{...base,type:'bands',allowance:-Number(km[1])*10,label:'K code'};
  let nm=code.match(/^(\d{1,4})[LMNT]?$/);if(nm)return{...base,type:'bands',allowance:Number(nm[1])*10,label:'Allowance code'};
  return{...base,type:'unknown',label:'Code not recognised by this checker'}
}
function bandTax(taxable,region='ruk'){
  let r=Math.max(0,taxable),tax=0,parts=[];
  const bands=region==='scotland'?D.scotBands:D.rukBands;
  for(const [w,rate] of bands){const s=Math.min(r,w);if(s>0){tax+=s*rate;parts.push([s,rate])}r-=s;if(r<=0)break}
  return{tax,parts}
}
function incomeTax(income,opts={}){
  income=clamp(income);
  const code=parseCode(opts.taxCode||'',opts.region||'ruk'),region=code?.region||opts.region||'ruk';
  if(code?.type==='nt')return{tax:0,allowance:income,taxable:0,code};
  if(code?.type==='flat')return{tax:income*code.rate,allowance:0,taxable:income,code};
  // The standard 1257L code does not reflect the £100,000 taper, so the full annual allowance rules apply to it.
  const standard=code?.type!=='bands'||code.allowance===D.pa;
  let a=standard?allowance(opts.adjustedNetIncome??income,!!opts.blind):code.allowance;
  const taxable=Math.max(0,income-a),r=bandTax(taxable,region);
  // A K code cannot take more than half of the pay in tax (the overriding limit).
  const tax=a<0?Math.min(r.tax,income*.5):r.tax;
  return{tax,allowance:a,taxable,parts:r.parts,code}
}
function employeeNI(e){e=clamp(e);return Math.max(0,Math.min(e,D.ni.uel)-D.ni.pt)*D.ni.main+Math.max(0,e-D.ni.uel)*D.ni.upper}
function employerNI(e){e=clamp(e);return Math.max(0,e-D.employerNI.st)*D.employerNI.rate}
function class4(p){p=clamp(p);return Math.max(0,Math.min(p,D.class4.upper)-D.class4.lower)*D.class4.main+Math.max(0,p-D.class4.upper)*D.class4.upperRate}
function studentLoan(e,plan){if(!D.student[plan])return 0;const [th,r]=D.student[plan];return Math.max(0,e-th)*r}
function salary(i){
  const gross=annualise(clamp(i.gross),i.frequency||'year'),pension=gross*clamp(i.pensionPct,0,100)/100,taxablePay=Math.max(0,gross-pension);
  const it=incomeTax(taxablePay,{region:i.region||'ruk',taxCode:i.taxCode||'',blind:i.blind===true,adjustedNetIncome:taxablePay}),tax=it.tax;
  const ni=i.noNI?0:employeeNI(taxablePay),loan=studentLoan(taxablePay,i.loanPlan||'none')+(i.postgrad?studentLoan(taxablePay,'pg'):0);
  const net=Math.max(0,taxablePay-tax-ni-loan),codeStatus=!it.code?'none':it.code.type==='unknown'?'unrecognised':'used';
  return{gross,pension,taxablePay,tax,ni,loan,net,monthly:net/12,weekly:net/52,codeStatus,code:it.code}
}
function selfEmployed(i){
  const turnover=clamp(i.turnover),expenses=clamp(i.expenses),other=clamp(i.otherIncome),region=i.region||'ruk';
  // Gross trading income of £1,000 or less is fully relieved by the trading allowance.
  const fullRelief=turnover>0&&turnover<=D.tradingAllowance,profit=fullRelief?0:Math.max(0,turnover-expenses),loss=fullRelief?0:Math.max(0,expenses-turnover);
  // Tax on the other income is measured on its own, so any Personal Allowance lost because of the profit counts as tax on the profit.
  const combined=incomeTax(profit+other,{region,adjustedNetIncome:profit+other}).tax,base=incomeTax(other,{region,adjustedNetIncome:other}).tax,tax=Math.max(0,combined-base),ni=class4(profit);
  return{turnover,expenses,profit,loss,fullRelief,other,tax,ni,total:tax+ni,after:Math.max(0,profit-tax-ni),incomeTaxAll:combined}
}
function paymentsOnAccount(i){
  const liability=clamp(i.liability),outside=clamp(i.outside),relevant=Math.max(0,liability-outside),outsidePct=liability?outside/liability:0,required=relevant>=1000&&outsidePct<=.80,each=required?relevant/2:0;
  return{liability,outside,relevant,outsidePct,required,each,jan:relevant+each,july:each}
}
function selfAssessment(i){
  // The return covers all income, so the liability is the tax on everything; tax already deducted (PAYE, CIS) is then credited once.
  const se=selfEmployed(i),liability=se.incomeTaxAll+se.ni,deducted=clamp(i.taxDeducted),balance=liability-deducted,poa=paymentsOnAccount({liability,outside:deducted});
  return{...se,liability,deducted,balance,poa}
}
function dividend(i){
  const other=clamp(i.otherIncome),div=clamp(i.dividends),total=other+div,pa=allowance(total),otherTaxable=Math.max(0,other-pa),paLeft=Math.max(0,pa-other),dTaxable=Math.max(0,div-paLeft),free=Math.min(D.dividend.allowance,dTaxable);
  let charge=Math.max(0,dTaxable-free),occupied=otherTaxable+free,tax=0,s=Math.min(charge,Math.max(0,37700-occupied));tax+=s*D.dividend.basic;charge-=s;occupied+=s;s=Math.min(charge,Math.max(0,125140-occupied));tax+=s*D.dividend.higher;charge-=s;if(charge>0)tax+=charge*D.dividend.additional;
  return{other,div,allowanceUsed:free,tax,after:Math.max(0,div-tax)}
}
function savings(i){
  const non=clamp(i.nonSavings),interest=clamp(i.interest),total=non+interest,pa=allowance(total),nonTaxable=Math.max(0,non-pa),start=Math.max(0,D.savings.starting-nonTaxable);
  const taxableTotal=Math.max(0,total-pa),psa=taxableTotal<=37700?D.savings.psaBasic:taxableTotal<=125140?D.savings.psaHigher:0;
  let charge=Math.max(0,interest-start-psa),occupied=nonTaxable+Math.min(interest,start+psa),tax=0;
  let s=Math.min(charge,Math.max(0,37700-occupied));tax+=s*.20;charge-=s;occupied+=s;s=Math.min(charge,Math.max(0,125140-occupied));tax+=s*.40;charge-=s;if(charge>0)tax+=charge*.45;
  return{non,interest,startUsed:Math.min(start,interest),psaUsed:Math.min(psa,Math.max(0,interest-start)),tax,after:interest-tax}
}
function corporation(i){
  const profit=clamp(i.profit),assoc=Math.max(0,Math.floor(+i.associated||0)),divisor=assoc+1,lower=D.corp.lower/divisor,upper=D.corp.upper/divisor;
  let tax,treatment;if(profit<=lower){tax=profit*D.corp.small;treatment='Small profits rate'}else if(profit>=upper){tax=profit*D.corp.main;treatment='Main rate'}else{tax=profit*D.corp.main-(upper-profit)*D.corp.fraction;treatment='Marginal relief'}
  return{profit,assoc,lower,upper,tax,after:Math.max(0,profit-tax),effective:profit?tax/profit:0,treatment}
}
function bonus(i){const before=salary({gross:i.salary,frequency:'year',region:i.region,loanPlan:i.loanPlan}),after=salary({gross:clamp(i.salary)+clamp(i.bonus),frequency:'year',region:i.region,loanPlan:i.loanPlan});return{bonus:clamp(i.bonus),tax:after.tax-before.tax,ni:after.ni-before.ni,loan:after.loan-before.loan,net:after.net-before.net}}
function twoJobs(i){const a=clamp(i.job1),b=clamp(i.job2),gross=a+b,tax=incomeTax(gross,{region:i.region||'ruk',adjustedNetIncome:gross}).tax,ni=employeeNI(a)+employeeNI(b),loan=studentLoan(a,i.loanPlan||'none')+studentLoan(b,i.loanPlan||'none');return{gross,tax,ni,loan,net:Math.max(0,gross-tax-ni-loan)}}
function employerCost(i){const sal=clamp(i.salary),pension=sal*clamp(i.pensionPct,0,100)/100,ni=employerNI(sal);return{salary:sal,pension,ni,total:sal+pension+ni}}
function hourlySalary(i){const h=clamp(i.hourly),hours=clamp(i.hours),weeks=clamp(i.weeks)||52,annual=h*hours*weeks;return{hourly:h,hours,weeks,weekly:h*hours,monthly:annual/12,annual}}
function salaryHourly(i){const sal=clamp(i.salary),hours=Math.max(.01,clamp(i.hours)),weeks=Math.max(.01,clamp(i.weeks)||52);return{salary:sal,hours,weeks,hourly:sal/(hours*weeks),weekly:sal/weeks,monthly:sal/12}}
function netGross(i){const target=clamp(i.target),region=i.region||'ruk';let lo=0,hi=Math.max(50000,target*2);for(let n=0;n<15&&salary({gross:hi,frequency:'year',region}).net<target;n++)hi*=1.5;for(let n=0;n<70;n++){const m=(lo+hi)/2;if(salary({gross:m,frequency:'year',region}).net<target)lo=m;else hi=m}const gross=(lo+hi)/2;return{target,gross,detail:salary({gross,frequency:'year',region})}}
function salarySacrifice(i){const gross=clamp(i.salary),pct=clamp(i.pct,0,100),before=salary({gross,frequency:'year',region:i.region||'ruk'}),after=salary({gross,frequency:'year',region:i.region||'ruk',pensionPct:pct});return{gross,pct,sacrifice:after.pension,taxSaving:before.tax-after.tax,niSaving:before.ni-after.ni,cashCost:before.net-after.net,before:before.net,after:after.net}}
function vat(i){
  const amount=round2(clamp(i.amount)),r=i.rate===undefined||i.rate===''?NaN:+i.rate,rate=Number.isFinite(r)?clamp(r,0,1):D.vat.standard;
  // Round the VAT once to the nearest penny and derive the other figure, so net + VAT always equals gross.
  if(i.mode==='remove'){const v=round2(amount*rate/(1+rate));return{net:round2(amount-v),vat:v,gross:amount,rate,mode:'remove'}}
  const v=round2(amount*rate);return{net:amount,vat:v,gross:round2(amount+v),rate,mode:'add'}
}
function vatRegistration(i){const turnover=clamp(i.turnover);return{turnover,threshold:D.vat.registration,over:turnover>D.vat.registration,diff:turnover-D.vat.registration}}
function cgt(i){
  const proceeds=clamp(i.proceeds),cost=clamp(i.cost),costs=clamp(i.costs),losses=clamp(i.losses),lossesBf=clamp(i.lossesBf),income=clamp(i.income);
  const raw=proceeds-cost-costs,gain=Math.max(0,raw),lossOnDisposal=Math.max(0,-raw);
  // Losses from the same tax year are set off in full; brought-forward losses only reduce gains down to the annual exempt amount.
  const net=Math.max(0,gain-losses),bfUsed=Math.min(lossesBf,Math.max(0,net-D.cgt.allowance)),aeaUsed=Math.min(D.cgt.allowance,net-bfUsed),taxableGain=Math.max(0,net-bfUsed-D.cgt.allowance);
  const taxableIncome=Math.max(0,income-allowance(income)),basicSpace=Math.max(0,D.rukBands[0][0]-taxableIncome),basicGain=Math.min(taxableGain,basicSpace),higherGain=Math.max(0,taxableGain-basicGain),tax=basicGain*D.cgt.basic+higherGain*D.cgt.higher;
  const carriedForward=lossesBf-bfUsed+Math.max(0,losses-gain)+lossOnDisposal;
  return{proceeds,cost,costs,losses,lossesBf,gain,lossOnDisposal,net,bfUsed,aeaUsed,taxableGain,basicGain,higherGain,tax,carriedForward,after:gain-tax}
}
function sdlt(i){
  const price=clamp(i.price),first=!!i.first,additional=!!i.additional,nonresident=!!i.nonresident;
  if(first&&!additional&&price<=500000){
    const tax=Math.max(0,price-300000)*.05+(nonresident?price*.02:0);
    return{price,tax,treatment:nonresident?'First-time buyer relief plus non-resident surcharge':'First-time buyer relief'}
  }
  const surcharge=(additional?.05:0)+(nonresident?.02:0),bands=[[125000,0],[125000,.02],[675000,.05],[575000,.10],[Infinity,.12]];
  let rem=price,tax=0;for(const [w,r] of bands){const s=Math.min(rem,w);tax+=s*(r+surcharge);rem-=s;if(rem<=0)break}
  return{price,tax,treatment:additional?'Additional property rates':nonresident?'Non-resident rates':'Standard residential rates'}
}
function lbtt(i){
  const price=clamp(i.price),first=!!i.first,additional=!!i.additional,bands=[[145000,0],[105000,.02],[75000,.05],[425000,.10],[Infinity,.12]];
  let rem=price,tax=0;for(const [w,r] of bands){const s=Math.min(rem,w);tax+=s*r;rem-=s;if(rem<=0)break}
  if(first&&!additional)tax=Math.max(0,tax-Math.min(600,tax));
  const ads=additional&&price>=40000?price*.08:0;
  return{price,base:tax,ads,total:tax+ads,treatment:additional?'LBTT plus 8% ADS':first?'First-time buyer relief':'Standard LBTT'}
}
function ltt(i){
  const price=clamp(i.price),higher=!!i.higher;
  const bands=higher?[[180000,.05],[70000,.085],[150000,.10],[350000,.125],[750000,.15],[Infinity,.17]]:[[225000,0],[175000,.06],[350000,.075],[750000,.10],[Infinity,.12]];
  let rem=price,tax=0;for(const [w,r] of bands){const s=Math.min(rem,w);tax+=s*r;rem-=s;if(rem<=0)break}
  return{price,tax,treatment:higher?'Higher residential rates':'Main residential rates'}
}
function pensionAllowance(i){
  const adjusted=clamp(i.adjusted),threshold=clamp(i.threshold),savings=clamp(i.savings),mpaa=!!i.mpaa;
  let a=D.pension.annual;if(threshold>D.pension.thresholdIncome&&adjusted>D.pension.adjustedIncome)a=Math.max(D.pension.min,D.pension.annual-(adjusted-D.pension.adjustedIncome)/2);if(mpaa)a=Math.min(a,D.pension.mpaa);
  return{adjusted,threshold,savings,allowance:a,excess:Math.max(0,savings-a),mpaa}
}
function hicbc(i){
  const income=clamp(i.income),children=Math.max(1,Math.floor(+i.children||1)),weeks=clamp(i.weeks,0,52)||52,benefit=(D.childBenefit.first+(children-1)*D.childBenefit.other)*weeks,percent=income<=D.childBenefit.start?0:Math.min(1,Math.floor((income-D.childBenefit.start)/200)*.01),charge=benefit*percent;
  return{income,children,weeks,benefit,percent,charge,kept:benefit-charge}
}
function marriage(i){
  const low=clamp(i.lower),high=clamp(i.higher),region=i.region||'ruk',limit=region==='scotland'?43662:50270,eligible=low<D.pa&&high>D.pa&&high<=limit;
  return{low,high,region,eligible,transfer:D.marriage.transfer,saving:eligible?D.marriage.saving:0,limit}
}
function minimumWage(i){const rate=clamp(i.rate),required=D.minimumWage[i.category||'adult21'];return{rate,required,meets:rate>=required,diff:rate-required}}
function cis(i){const payment=clamp(i.payment),materials=clamp(i.materials),rate=i.rate==='30'?.30:i.rate==='0'?0:.20,base=Math.max(0,payment-materials),deduction=base*rate;return{payment,materials,base,rate,deduction,net:payment-deduction}}
function tradingAllowance(i){
  const income=clamp(i.income),expenses=clamp(i.expenses),actualProfit=income-expenses,allowanceProfit=Math.max(0,income-D.tradingAllowance),fullRelief=income>0&&income<=D.tradingAllowance;
  const best=fullRelief?0:Math.max(0,Math.min(actualProfit,allowanceProfit));
  const method=fullRelief?'Full relief: income is £1,000 or less':actualProfit<0?'Actual expenses (keeps the loss)':allowanceProfit<actualProfit?'Trading allowance':actualProfit<allowanceProfit?'Actual expenses':'Either method gives the same profit';
  return{income,expenses,actualProfit,allowanceProfit,best,method,fullRelief}
}
function rental(i){
  const rent=clamp(i.rent),expenses=clamp(i.expenses),finance=clamp(i.finance),other=clamp(i.otherIncome),region=i.region||'ruk';
  // Gross property income of £1,000 or less is fully relieved by the property allowance.
  const fullRelief=rent>0&&rent<=D.propertyAllowance,useAllowance=!fullRelief&&!!i.useAllowance,noCredit=fullRelief||useAllowance;
  const profit=fullRelief?0:Math.max(0,rent-(useAllowance?D.propertyAllowance:expenses)),total=other+profit;
  const combined=incomeTax(total,{region,adjustedNetIncome:total}).tax,base=incomeTax(other,{region,adjustedNetIncome:other}).tax,grossTax=Math.max(0,combined-base);
  // Basic rate credit: 20% of the lowest of finance costs, property profits and adjusted total income above the Personal Allowance.
  const relieved=noCredit?0:Math.min(finance,profit,Math.max(0,total-allowance(total))),credit=Math.min(relieved*.20,combined),tax=Math.max(0,combined-credit)-base;
  return{rent,expenses,finance,profit,grossTax,credit,tax,carried:noCredit?0:finance-relieved,after:profit-tax,method:fullRelief?'Property allowance, full relief':useAllowance?'Property allowance':'Actual expenses'}
}
function rentRoom(i){
  const income=clamp(i.income),expenses=clamp(i.expenses),shared=!!i.shared,limit=shared?D.rentRoom/2:D.rentRoom;
  // Method B taxes receipts above the limit; Method A is the normal profit after expenses. The lower result is shown.
  const methodB=Math.max(0,income-limit),methodA=Math.max(0,income-expenses),exempt=income<=limit,taxable=exempt?0:Math.min(methodA,methodB);
  const method=exempt?'Fully covered by the limit':methodA<methodB?'Normal method (receipts less expenses)':'Rent a Room scheme (receipts less limit)';
  return{income,expenses,shared,limit,methodA,methodB,taxable,method}
}
function inheritance(i){
  const estate=clamp(i.estate),debts=clamp(i.debts),home=clamp(i.home),nrbTransfer=clamp(i.nrbTransfer,0,100)/100,rnrbTransfer=clamp(i.rnrbTransfer,0,100)/100,direct=!!i.direct;
  const estateNet=Math.max(0,estate-debts),charity=Math.min(clamp(i.charity),estateNet),net=estateNet-charity,nrb=D.iht.nrb*(1+nrbTransfer);
  // The taper (£1 for every £2 over £2m of the estate before exemptions) reduces the allowance first; the result is then capped at the home's value.
  const rnrb=direct?Math.min(home,Math.max(0,D.iht.rnrb*(1+rnrbTransfer)-Math.max(0,estateNet-D.iht.taperStart)/2)):0;
  // 36% applies when charity gets at least 10% of the baseline: the estate after debts and the nil-rate band, with the gift added back.
  const baseline=Math.max(0,estateNet-nrb),charityQualifies=charity>0&&charity*10>=baseline;
  const taxable=Math.max(0,net-nrb-rnrb),rate=charityQualifies?D.iht.charityRate:D.iht.rate,tax=taxable*rate;
  return{estate,debts,charity,net,nrb,rnrb,taxable,rate,tax,after:Math.max(0,net-tax),baseline,charityQualifies,charityShortfall:Math.max(0,baseline/10-charity)}
}
function allowableExpenses(i){
  const E=D.expenses,turnover=clamp(i.turnover),items=[],add=(label,amount,detail='')=>{if(amount>0)items.push({label,amount,detail})};
  [['stock','Goods for resale and materials'],['staff','Staff and subcontractor costs'],['premises','Business premises costs'],['repairs','Repairs and maintenance'],['office','Office, phone, internet and software'],['travel','Travel and subsistence'],['advertising','Advertising and marketing'],['financial','Bank, card and loan interest charges'],['professional','Accountancy, legal and professional fees'],['equipment','Equipment and tools (not cars)'],['other','Other allowable costs']].forEach(([k,label])=>add(label,clamp(i[k])));
  const vehicleMethod=i.vehicleMethod||'simplified';
  if(vehicleMethod==='simplified'){
    const car=clamp(i.carMiles),bike=clamp(i.bikeMiles),carFirst=Math.min(car,E.carLimit);
    add('Car or van mileage',carFirst*E.car+(car-carFirst)*E.carAfter,`${car.toLocaleString('en-GB')} miles at ${Math.round(E.car*100)}p, then ${Math.round(E.carAfter*100)}p after ${E.carLimit.toLocaleString('en-GB')}`);
    add('Motorcycle mileage',bike*E.motorcycle,`${bike.toLocaleString('en-GB')} miles at ${Math.round(E.motorcycle*100)}p`);
  }else if(vehicleMethod==='actual'){const pct=clamp(i.vehiclePct,0,100);add('Vehicle running costs',clamp(i.vehicleCosts)*pct/100,`${pct}% business use`)}
  const homeMethod=i.homeMethod||'none';
  if(homeMethod==='flat'){
    const hours=clamp(i.homeHours),months=clamp(i.homeMonths,0,12),band=E.home.find(([h])=>hours>=h);
    add('Working from home (flat rate)',band?band[1]*months:0,band?`£${band[1]} a month for ${months} months`:'');
  }else if(homeMethod==='actual'){const pct=clamp(i.homePct,0,100);add('Use of home (actual costs)',clamp(i.homeCosts)*pct/100,`${pct}% business share`)}
  const livingCosts=clamp(i.livingCosts);
  if(livingCosts>0){
    const people=Math.min(3,Math.max(1,Math.floor(+i.livingPeople||1))),months=clamp(i.livingMonths,0,12),privateUse=E.premises[people-1]*months;
    add('Premises you also live in',Math.max(0,livingCosts-privateUse),`costs less £${privateUse.toLocaleString('en-GB')} private use`);
  }
  const total=items.reduce((s,x)=>s+x.amount,0),actualProfit=turnover-total,allowanceProfit=Math.max(0,turnover-D.tradingAllowance);
  // The £1,000 trading allowance replaces all expenses, so use it only when it gives a lower profit.
  const method=allowanceProfit<actualProfit?'allowance':'actual',deduction=method==='allowance'?Math.min(turnover,D.tradingAllowance):total;
  const opts={turnover,otherIncome:clamp(i.otherIncome),region:i.region||'ruk'},withClaim=selfEmployed({...opts,expenses:deduction}),without=selfEmployed({...opts,expenses:0});
  return{turnover,items,total,actualProfit,allowanceProfit,method,deduction,profit:withClaim.profit,loss:withClaim.loss,taxAndNI:withClaim.total,saving:without.total-withClaim.total}
}
function taxCode(i){return{code:String(i.code||'').toUpperCase(),parsed:parseCode(i.code||'',i.region||'ruk')}}
window.TaxFlow={D,money,pct,annualise,allowance,parseCode,incomeTax,employeeNI,employerNI,class4,studentLoan,salary,selfEmployed,paymentsOnAccount,selfAssessment,dividend,savings,corporation,bonus,twoJobs,employerCost,hourlySalary,salaryHourly,netGross,salarySacrifice,vat,vatRegistration,cgt,sdlt,lbtt,ltt,pensionAllowance,hicbc,marriage,minimumWage,cis,tradingAllowance,rental,rentRoom,inheritance,allowableExpenses,taxCode};
})();
