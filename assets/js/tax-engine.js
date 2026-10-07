
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
  iht:{nrb:325000,rnrb:175000,taperStart:2000000,rate:.40,charityRate:.36}
};
const money=n=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:2}).format(Number.isFinite(n)?n:0);
const pct=n=>`${(n*100).toFixed(2).replace(/\.00$/,'')}%`;
const clamp=(n,min=0,max=Infinity)=>Math.min(max,Math.max(min,+n||0));
const annualise=(v,f)=>f==='month'?v*12:f==='week'?v*52:v;
function allowance(income,blind=false){let a=Math.max(0,D.pa-Math.max(0,income-D.paTaper)/2);if(blind)a+=D.blind;return a}
function parseCode(raw,region='ruk'){
  if(!raw)return null;
  let original=String(raw).trim().toUpperCase().replace(/\s+/g,''),code=original.replace(/(W1|M1|X)$/,'');
  let emergency=code!==original;
  if(code.startsWith('S'))code=code.slice(1);
  if(code.startsWith('C'))code=code.slice(1);
  if(code==='NT')return{type:'nt',allowance:Infinity,label:'No tax code',emergency};
  if(code==='BR')return{type:'flat',rate:.20,label:'Basic rate on all pay',emergency};
  if(code==='D0')return{type:'flat',rate:region==='scotland'?.42:.40,label:'Higher rate code',emergency};
  if(code==='D1')return{type:'flat',rate:region==='scotland'?.45:.45,label:'Additional or advanced rate code',emergency};
  if(code==='0T')return{type:'bands',allowance:0,label:'No Personal Allowance',emergency};
  let km=code.match(/^K(\d+)/);if(km)return{type:'bands',allowance:-Number(km[1])*10,label:'K code',emergency};
  let nm=code.match(/^(\d{1,4})[LMNT]?$/);if(nm)return{type:'bands',allowance:Number(nm[1])*10,label:'Allowance code',emergency};
  return{type:'unknown',label:'Code not recognised by this checker',emergency}
}
function bandTax(taxable,region='ruk'){
  let r=Math.max(0,taxable),tax=0,parts=[];
  const bands=region==='scotland'?D.scotBands:D.rukBands;
  for(const [w,rate] of bands){const s=Math.min(r,w);if(s>0){tax+=s*rate;parts.push([s,rate])}r-=s;if(r<=0)break}
  return{tax,parts}
}
function incomeTax(income,opts={}){
  income=clamp(income);
  const region=opts.region||'ruk',code=parseCode(opts.taxCode||'',region);
  if(code?.type==='nt')return{tax:0,allowance:income,taxable:0,code};
  if(code?.type==='flat')return{tax:income*code.rate,allowance:0,taxable:income,code};
  let a=code?.type==='bands'?code.allowance:allowance(opts.adjustedNetIncome??income,!!opts.blind);
  const taxable=Math.max(0,income-a),r=bandTax(taxable,region);
  return{tax:r.tax,allowance:a,taxable,parts:r.parts,code}
}
function employeeNI(e){e=clamp(e);return Math.max(0,Math.min(e,D.ni.uel)-D.ni.pt)*D.ni.main+Math.max(0,e-D.ni.uel)*D.ni.upper}
function employerNI(e){e=clamp(e);return Math.max(0,e-D.employerNI.st)*D.employerNI.rate}
function class4(p){p=clamp(p);return Math.max(0,Math.min(p,D.class4.upper)-D.class4.lower)*D.class4.main+Math.max(0,p-D.class4.upper)*D.class4.upperRate}
function studentLoan(e,plan){if(!D.student[plan])return 0;const [th,r]=D.student[plan];return Math.max(0,e-th)*r}
function salary(i){
  const gross=annualise(clamp(i.gross),i.frequency||'year'),pension=gross*clamp(i.pensionPct,0,100)/100,taxablePay=Math.max(0,gross-pension);
  const tax=incomeTax(taxablePay,{region:i.region||'ruk',taxCode:i.taxCode||'',blind:i.blind===true,adjustedNetIncome:taxablePay}).tax;
  const ni=i.noNI?0:employeeNI(taxablePay),loan=studentLoan(taxablePay,i.loanPlan||'none')+(i.postgrad?studentLoan(taxablePay,'pg'):0);
  const net=Math.max(0,taxablePay-tax-ni-loan);
  return{gross,pension,taxablePay,tax,ni,loan,net,monthly:net/12,weekly:net/52}
}
function selfEmployed(i){
  const turnover=clamp(i.turnover),expenses=clamp(i.expenses),profit=Math.max(0,turnover-expenses),other=clamp(i.otherIncome),combined=incomeTax(profit+other,{region:i.region||'ruk',adjustedNetIncome:profit+other}).tax,base=incomeTax(other,{region:i.region||'ruk',adjustedNetIncome:profit+other}).tax,tax=Math.max(0,combined-base),ni=class4(profit);
  return{turnover,expenses,profit,other,tax,ni,total:tax+ni,after:Math.max(0,profit-tax-ni)}
}
function paymentsOnAccount(i){
  const liability=clamp(i.liability),outside=clamp(i.outside),relevant=Math.max(0,liability-outside),outsidePct=liability?outside/liability:0,required=relevant>=1000&&outsidePct<=.80,each=required?relevant/2:0;
  return{liability,outside,relevant,outsidePct,required,each,jan:relevant+each,july:each}
}
function selfAssessment(i){
  const se=selfEmployed(i),deducted=clamp(i.taxDeducted),balance=Math.max(0,se.total-deducted),poa=paymentsOnAccount({liability:se.total,outside:deducted});
  return{...se,deducted,balance,poa}
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
function twoJobs(i){const a=clamp(i.job1),b=clamp(i.job2),gross=a+b,tax=incomeTax(gross,{region:i.region||'ruk',adjustedNetIncome:gross}).tax,ni=employeeNI(a)+employeeNI(b),loan=studentLoan(gross,i.loanPlan||'none');return{gross,tax,ni,loan,net:Math.max(0,gross-tax-ni-loan)}}
function employerCost(i){const sal=clamp(i.salary),pension=sal*clamp(i.pensionPct,0,100)/100,ni=employerNI(sal);return{salary:sal,pension,ni,total:sal+pension+ni}}
function hourlySalary(i){const h=clamp(i.hourly),hours=clamp(i.hours),weeks=clamp(i.weeks)||52,annual=h*hours*weeks;return{hourly:h,hours,weeks,weekly:h*hours,monthly:annual/12,annual}}
function salaryHourly(i){const sal=clamp(i.salary),hours=Math.max(.01,clamp(i.hours)),weeks=Math.max(.01,clamp(i.weeks)||52);return{salary:sal,hours,weeks,hourly:sal/(hours*weeks),weekly:sal/weeks,monthly:sal/12}}
function netGross(i){const target=clamp(i.target),region=i.region||'ruk';let lo=0,hi=Math.max(50000,target*2);for(let n=0;n<15&&salary({gross:hi,frequency:'year',region}).net<target;n++)hi*=1.5;for(let n=0;n<70;n++){const m=(lo+hi)/2;if(salary({gross:m,frequency:'year',region}).net<target)lo=m;else hi=m}const gross=(lo+hi)/2;return{target,gross,detail:salary({gross,frequency:'year',region})}}
function salarySacrifice(i){const gross=clamp(i.salary),pct=clamp(i.pct,0,100),before=salary({gross,frequency:'year',region:i.region||'ruk'}),after=salary({gross,frequency:'year',region:i.region||'ruk',pensionPct:pct});return{gross,pct,sacrifice:after.pension,taxSaving:before.tax-after.tax,niSaving:before.ni-after.ni,cashCost:before.net-after.net,before:before.net,after:after.net}}
function vat(i){const amount=clamp(i.amount),rate=+i.rate||.20;if(i.mode==='remove'){const net=amount/(1+rate);return{net,vat:amount-net,gross:amount,rate}}return{net:amount,vat:amount*rate,gross:amount*(1+rate),rate}}
function vatRegistration(i){const turnover=clamp(i.turnover);return{turnover,threshold:D.vat.registration,over:turnover>D.vat.registration,diff:turnover-D.vat.registration}}
function cgt(i){
  const proceeds=clamp(i.proceeds),cost=clamp(i.cost),costs=clamp(i.costs),losses=clamp(i.losses),income=clamp(i.income),gain=Math.max(0,proceeds-cost-costs-losses),taxableGain=Math.max(0,gain-D.cgt.allowance),taxableIncome=Math.max(0,income-allowance(income)),basicSpace=Math.max(0,37700-taxableIncome),basicGain=Math.min(taxableGain,basicSpace),higherGain=Math.max(0,taxableGain-basicGain),tax=basicGain*D.cgt.basic+higherGain*D.cgt.higher;
  return{proceeds,cost,costs,losses,gain,taxableGain,basicGain,higherGain,tax,after:gain-tax}
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
function tradingAllowance(i){const income=clamp(i.income),expenses=clamp(i.expenses),actualProfit=Math.max(0,income-expenses),allowanceProfit=Math.max(0,income-D.tradingAllowance),best=Math.min(actualProfit,allowanceProfit),method=allowanceProfit<actualProfit?'Trading allowance':'Actual expenses';return{income,expenses,actualProfit,allowanceProfit,best,method}}
function rental(i){
  const rent=clamp(i.rent),expenses=clamp(i.expenses),finance=clamp(i.finance),other=clamp(i.otherIncome),useAllowance=!!i.useAllowance;
  const profit=Math.max(0,rent-(useAllowance?D.propertyAllowance:expenses)),combined=incomeTax(other+profit,{region:i.region||'ruk',adjustedNetIncome:other+profit}).tax,base=incomeTax(other,{region:i.region||'ruk',adjustedNetIncome:other+profit}).tax,grossTax=Math.max(0,combined-base),credit=useAllowance?0:Math.min(grossTax,finance*.20),tax=Math.max(0,grossTax-credit);
  return{rent,expenses,finance,profit,grossTax,credit,tax,after:Math.max(0,profit-tax),method:useAllowance?'Property allowance':'Actual expenses'}
}
function rentRoom(i){const income=clamp(i.income),shared=!!i.shared,limit=shared?D.rentRoom/2:D.rentRoom,taxable=Math.max(0,income-limit);return{income,shared,limit,taxable}}
function inheritance(i){
  const estate=clamp(i.estate),debts=clamp(i.debts),charity=clamp(i.charity),home=clamp(i.home),nrbTransfer=clamp(i.nrbTransfer,0,100)/100,rnrbTransfer=clamp(i.rnrbTransfer,0,100)/100,direct=!!i.direct;
  const net=Math.max(0,estate-debts-charity),nrb=D.iht.nrb*(1+nrbTransfer);
  let rnrb=direct?D.iht.rnrb*(1+rnrbTransfer):0;rnrb=Math.min(rnrb,home);rnrb=Math.max(0,rnrb-Math.max(0,(estate-debts)-D.iht.taperStart)/2);
  const taxable=Math.max(0,net-nrb-rnrb),rate=i.charityRate?D.iht.charityRate:D.iht.rate,tax=taxable*rate;
  return{estate,debts,charity,net,nrb,rnrb,taxable,rate,tax,after:Math.max(0,net-tax)}
}
function taxCode(i){return{code:String(i.code||'').toUpperCase(),parsed:parseCode(i.code||'',i.region||'ruk')}}
window.TaxFlow={D,money,pct,annualise,allowance,parseCode,incomeTax,employeeNI,employerNI,class4,studentLoan,salary,selfEmployed,paymentsOnAccount,selfAssessment,dividend,savings,corporation,bonus,twoJobs,employerCost,hourlySalary,salaryHourly,netGross,salarySacrifice,vat,vatRegistration,cgt,sdlt,lbtt,ltt,pensionAllowance,hicbc,marriage,minimumWage,cis,tradingAllowance,rental,rentRoom,inheritance,taxCode};
})();
