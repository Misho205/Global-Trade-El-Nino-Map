export const plans = [
 {id:'free',name:'Free Observer',monthlyEUR:0,scenariosPerMonth:0,features:['Public globe and schematic trade corridors','Available NOAA, WTO and annual trade data','Historical exploration within source coverage','No account required for public observation']},
 {id:'professional',name:'Professional',monthlyEUR:49,scenariosPerMonth:20,features:['Everything in Free','20 saved comparisons per UTC calendar month','Up to 5 manually entered transport alternatives per comparison','Time and cost estimates from your operating assumptions','Private history and JSON export','One individual account']},
 {id:'fleet',name:'Fleet',monthlyEUR:199,scenariosPerMonth:200,features:['Everything in Professional','200 saved comparisons per UTC calendar month','Private history and JSON export','One individual account for a higher-volume planning workflow','Team seats and live routing are not included']},
] as const;
export type PaidPlan = 'professional'|'fleet';
export function isPaidPlan(value:unknown):value is PaidPlan {return value==='professional'||value==='fleet';}
export function paidEntitlement(subscription:{plan:string;status:string;period_end:number}|null, now=Date.now()) {
 return !!subscription && isPaidPlan(subscription.plan) && subscription.status==='active' && subscription.period_end>Math.floor(now/1000);
}
export class BillingError extends Error {status:number;constructor(status:number,message:string){super(message);this.status=status;}}
export function requireSameOrigin(request:Request,origin:string){if(request.headers.get('Origin')!==origin)throw new BillingError(403,'Same-origin request required.');}

export function compareScenarios(input:any) {
 if(!input||typeof input!=='object'||typeof input.title!=='string'||!input.title.trim()||input.title.length>100||!Array.isArray(input.options)||input.options.length<2||input.options.length>5)throw new BillingError(400,'Provide a title and 2–5 transport alternatives.');
 const fields=['distanceKm','speedKmh','costPerKmEUR','operatingCostPerHourEUR','delayHours','feesEUR'] as const;
 const maximum={distanceKm:100000,speedKmh:1500,costPerKmEUR:10000,operatingCostPerHourEUR:100000,delayHours:8760,feesEUR:10000000};
 const options=input.options.map((option:any)=>{
  if(!option||typeof option.name!=='string'||!option.name.trim()||option.name.length>80||!['sea','road','rail','air'].includes(option.mode))throw new BillingError(400,'Every alternative needs a name and transport mode.');
  for(const field of fields)if(typeof option[field]!=='number'||!Number.isFinite(option[field])||option[field]<0||option[field]>maximum[field])throw new BillingError(400,`Invalid ${field}.`);
  if(option.speedKmh===0||option.distanceKm===0)throw new BillingError(400,'Distance and speed must be positive.');
  const durationHours=option.distanceKm/option.speedKmh+option.delayHours;
  const costEUR=option.distanceKm*option.costPerKmEUR+durationHours*option.operatingCostPerHourEUR+option.feesEUR;
  return {name:option.name.trim(),mode:option.mode,...Object.fromEntries(fields.map(field=>[field,option[field]])),durationHours:Math.round(durationHours*100)/100,costEUR:Math.round(costEUR*100)/100};
 });
 return {title:input.title.trim(),options,method:'User-entered distance, speed and operating costs. No live optimization or navigational clearance.',currency:'EUR'};
}
