export const categories = [
 {id:'goods',label:'Container goods',short:'Goods',sub:'Manufactured & consumer goods',color:'#61d9c7',symbol:'▣'},
 {id:'oil',label:'Oil & natural gas',short:'Oil & gas',sub:'Energy supply corridors',color:'#eeac68',symbol:'◈'},
 {id:'bulk',label:'Bulk commodities',short:'Commodities',sub:'Grain, ore & raw materials',color:'#a1bce6',symbol:'▥'},
 {id:'metals',label:'Precious metals',short:'Metals',sub:'Schematic bullion connections',color:'#e5cc79',symbol:'◇'},
 {id:'rail',label:'Land & rail',short:'Rail',sub:'Major overland connections',color:'#b99cec',symbol:'╬'},
 {id:'air',label:'Air freight',short:'Air',sub:'Schematic cargo hub connections',color:'#ee9cae',symbol:'✈'}
];
export const ports = [
 ['Shanghai',31.23,121.49],['Singapore',1.26,103.84],['Rotterdam',51.95,4.14],['Los Angeles',33.74,-118.27],['New York',40.67,-74.04],['Jebel Ali',24.99,55.06],['Busan',35.1,129.04],['Hong Kong',22.3,114.17],['Santos',-23.95,-46.32],['Cape Town',-33.9,18.42],['Sydney',-33.85,151.21],['Mumbai',18.95,72.84],['Vancouver',49.3,-123.1],['Panama',9.0,-79.6],['Suez',29.95,32.55]
].map(([name,lat,lon])=>({name:String(name),lat:Number(lat),lon:Number(lon)}));
export const stations = [
 {id:'9414290',name:'San Francisco, USA',lat:37.806,lon:-122.465},
 {id:'9410660',name:'Los Angeles, USA',lat:33.72,lon:-118.272},
 {id:'1612340',name:'Honolulu, Hawaii',lat:21.307,lon:-157.867},
 {id:'8724580',name:'Key West, USA',lat:24.55,lon:-81.808},
 {id:'8518750',name:'The Battery, New York',lat:40.7,lon:-74.014},
 {id:'1630000',name:'Apra Harbor, Guam',lat:13.443,lon:144.656},
 {id:'1770000',name:'Pago Pago, American Samoa',lat:-14.277,lon:-170.69},
 {id:'9755371',name:'San Juan, Puerto Rico',lat:18.459,lon:-66.116}
];
type Route={id:string;name:string;category:string;mode:string;cargo:string;description:string;path:number[][];source:string};
const maritime='https://unctad.org/topic/transport-and-trade-logistics/review-of-maritime-transport';
const energy='https://www.eia.gov/international/analysis/special-topics/world-oil-transit-chokepoints';
const bullion='https://www.lbma.org.uk/market-standards';
const r=(id:string,name:string,category:string,path:number[][],cargo:string,description:string):Route=>({id,name,category,path,cargo,description,mode:category==='air'||category==='metals'?'Air connection':category==='rail'?'Rail connection':'Sea corridor',source:category==='oil'?energy:category==='metals'?bullion:maritime});
export const routes:Route[]=[
 r('asia-europe','East Asia → Europe','goods',[[121.49,31.23],[125,25],[118,18],[110,8],[104,1.3],[100,5],[82,6],[60,12],[45,12],[43,13],[40,20],[34,27],[32.55,30],[32.3,31.5],[25,34],[14,36],[0,36],[-6,36],[-10,40],[-5,49],[4.14,51.95]],'Containers · Suez corridor','Illustrative Asia–Europe shipping corridor through Malacca and Suez. Actual services and diversions vary by carrier and date.'),
 r('pacific','East Asia → North America','goods',[[121.49,31.23],[130,32],[145,37],[165,43],[-175,45],[-150,43],[-130,36],[-118.27,33.74]],'Containers · transpacific','Approximate transpacific sea connection. Great-circle segments are constrained by ocean waypoints.'),
 r('atlantic','Europe → North America','goods',[[4.14,51.95],[-4,50],[-15,48],[-35,45],[-55,42],[-74.04,40.67]],'Containers · North Atlantic','Illustrative northern Atlantic connection between European and North American gateways.'),
 r('asia-us-east','Asia → US East Coast','goods',[[121.49,31.23],[135,25],[160,20],[-170,15],[-135,10],[-105,8],[-85,7],[-79.7,8.9],[-79.6,9.3],[-78,11],[-75,20],[-74,30],[-74.04,40.67]],'Containers · Panama corridor','Schematic Panama Canal corridor; canal lock geometry and operational restrictions are not represented.'),
 r('asia-cape','Asia → Europe via Cape','goods',[[103.84,1.26],[95,1],[75,-10],[55,-23],[35,-35],[18,-36],[8,-30],[-5,-10],[-17,15],[-13,35],[-5,49],[4.14,51.95]],'Containers · Cape of Good Hope','Approximate alternative sea corridor around southern Africa. Does not assert any active carrier diversion.'),
 r('asia-australia','East Asia → Australia','goods',[[121.49,31.23],[130,20],[140,2],[153,-12],[155,-25],[151.21,-33.85]],'Containers · western Pacific','Illustrative sea connection along the western Pacific.'),
 r('asia-latam','East Asia → South America','goods',[[121.49,31.23],[140,15],[170,0],[-155,-10],[-110,-20],[-78,-33]],'Containers · Pacific Latin America','Illustrative Asia–Chile sea corridor.'),
 r('singapore-mumbai','Singapore → Mumbai','goods',[[103.84,1.26],[100,5],[85,6],[75,8],[72.84,18.95]],'Containers · Indian Ocean','Illustrative connection between Southeast Asia and India.'),
 r('europe-brazil','Europe → Brazil','goods',[[4.14,51.95],[-5,49],[-14,32],[-25,5],[-40,-15],[-46.32,-23.95]],'Containers · South Atlantic','Illustrative Europe–Brazil ocean corridor.'),
 r('asia-africa','Asia → East Africa','goods',[[103.84,1.26],[100,5],[80,4],[60,-2],[39.7,-4]],'Containers · East Africa','Illustrative Asia–Mombasa connection.'),
 r('korea-us','Busan → Los Angeles','goods',[[129.04,35.1],[145,40],[170,47],[-160,47],[-135,39],[-118.27,33.74]],'Containers · transpacific','Illustrative Korean gateway connection.'),
 r('asia-canada','East Asia → Canada','goods',[[121.49,31.23],[140,38],[170,48],[-160,50],[-135,50],[-123.1,49.3]],'Containers · North Pacific','Illustrative connection to Vancouver.'),
 r('gulf-asia','Persian Gulf → East Asia','oil',[[50.2,26.6],[54,26],[56.5,26.5],[58,24],[65,15],[80,6],[100,5],[103.84,1.26],[110,8],[118,18],[125,25],[121.49,31.23]],'Crude oil · Hormuz & Malacca','Schematic oil corridor through the Strait of Hormuz and Strait of Malacca. See EIA chokepoint context; no live quantities are shown.'),
 r('gulf-europe','Persian Gulf → Europe','oil',[[50.2,26.6],[56.5,26.5],[58,24],[60,15],[50,12],[43,13],[40,20],[34,27],[32.55,30],[32.3,31.5],[25,34],[14,36],[0,36],[-6,36],[-10,40],[-5,49],[4.14,51.95]],'Oil & LNG · Suez corridor','Schematic energy supply corridor through Hormuz, Bab el-Mandeb and Suez.'),
 r('gulf-india','Persian Gulf → India','oil',[[50.2,26.6],[56.5,26.5],[58,24],[65,19],[72.84,18.95]],'Crude oil · Arabian Sea','Illustrative energy connection to western India.'),
 r('us-europe','US Gulf → Europe','oil',[[-95,28],[-88,25],[-82,24],[-78,28],[-65,35],[-40,42],[-15,48],[-5,49],[4.14,51.95]],'LNG & petroleum · Atlantic','Illustrative US Gulf–Europe energy connection.'),
 r('west-africa-asia','West Africa → Asia','oil',[[3.4,6.4],[4,0],[8,-18],[18,-36],[35,-35],[60,-20],[85,-5],[103.84,1.26]],'Crude oil · Cape corridor','Illustrative West African export connection around the Cape.'),
 r('brazil-asia-oil','Brazil → Asia','oil',[[-43.2,-23],[-30,-28],[0,-35],[18,-36],[50,-25],[80,-8],[103.84,1.26]],'Crude oil · South Atlantic','Illustrative Brazilian energy export corridor.'),
 r('norway-europe','Norway → Europe','oil',[[5.3,60.4],[3,58],[2,55],[4.14,51.95]],'Petroleum · North Sea','Illustrative North Sea petroleum connection; not a pipeline map.'),
 r('gulf-japan','Persian Gulf → Japan','oil',[[50.2,26.6],[56.5,26.5],[58,24],[80,6],[100,5],[103.84,1.26],[118,15],[130,27],[139.7,35.4]],'Oil & LNG · East Asia','Illustrative energy corridor to Japan.'),
 r('australia-asia','Australia → East Asia','bulk',[[118.6,-20.3],[115,-10],[113,-7],[108,-6],[104,1.3],[110,8],[118,18],[125,25],[121.49,31.23]],'Iron ore · bulk shipping','Illustrative ore corridor from Western Australia through Southeast Asian waters.'),
 r('brazil-china','Brazil → China','bulk',[[-40.3,-20.3],[-25,-25],[0,-35],[18,-36],[45,-30],[75,-10],[100,-5],[104,1.3],[118,18],[125,25],[121.49,31.23]],'Iron ore & soybeans','Illustrative bulk commodity connection; no shipment volume or company is implied.'),
 r('grain-atlantic','US Gulf → Europe','bulk',[[-90,29],[-88,25],[-82,24],[-75,30],[-50,40],[-20,47],[-5,49],[4.14,51.95]],'Grain · Atlantic','Illustrative grain supply connection.'),
 r('blacksea','Black Sea → Mediterranean','bulk',[[30.7,46.5],[29,43],[29,41],[28,40],[26,40],[25,38],[25,34],[14,36]],'Grain · Turkish Straits','Schematic Black Sea grain corridor through the Turkish Straits. Actual operations depend on security and restrictions.'),
 r('canada-grain','Canada → East Asia','bulk',[[-123.1,49.3],[-140,48],[-170,47],[165,45],[140,38],[129.04,35.1]],'Grain · North Pacific','Illustrative Canadian commodity export connection.'),
 r('chile-copper','Chile → East Asia','bulk',[[-71.6,-33],[-90,-30],[-125,-15],[-160,0],[160,12],[140,23],[121.49,31.23]],'Copper · Pacific','Illustrative Chilean copper connection across the Pacific.'),
 r('indo-coal','Indonesia → India','bulk',[[117,-1],[110,-5],[104,-4],[95,0],[80,6],[72.84,18.95]],'Coal · Indian Ocean','Illustrative Indonesian bulk export corridor.'),
 r('argentina-grain','Argentina → Europe','bulk',[[-58.4,-34.6],[-50,-35],[-35,-15],[-25,10],[-15,35],[-5,49],[4.14,51.95]],'Grain · South Atlantic','Illustrative Argentine agricultural export corridor.'),
 r('sa-asia','South Africa → Asia','bulk',[[31,-29.9],[45,-27],[70,-15],[95,-5],[104,1.3],[118,18],[125,25],[121.49,31.23]],'Minerals · Indian Ocean','Illustrative southern African bulk export connection.'),
 r('gold-london','Johannesburg → London','metals',[[28.24,-26.14],[-.45,51.47]],'Bullion · schematic air connection','Schematic connection between mining/refining and bullion-market hubs. This is not a reported shipment, flight plan or company route.'),
 r('gold-swiss','Dubai → Zurich','metals',[[55.36,25.25],[8.56,47.46]],'Bullion · schematic air connection','Illustrative connection between bullion trading/refining hubs. Physical itineraries are private and not tracked.'),
 r('gold-asia','Zurich → Hong Kong','metals',[[8.56,47.46],[113.92,22.31]],'Bullion · schematic air connection','Illustrative precious-metals hub connection, with no claim about actual consignments.'),
 r('gold-australia','Perth → Singapore','metals',[[115.97,-31.94],[103.99,1.36]],'Bullion · schematic air connection','Illustrative mining/refining hub connection.'),
 r('gold-us','New York → London','metals',[[-73.78,40.64],[-.45,51.47]],'Bullion · schematic air connection','Illustrative major bullion-market connection.'),
 r('eurasia-rail','China → Europe','rail',[[108.9,34.3],[87.6,43.8],[76.9,43.2],[71.4,51.2],[37.6,55.8],[27.6,53.9],[21,52.2],[6.8,51.4]],'Manufactured goods · Eurasian rail','Schematic Eurasian rail corridor, not a track alignment or an assertion of current operational availability.'),
 r('northamerica-rail','US → Mexico','rail',[[-87.6,41.9],[-94.6,39.1],[-100.5,27.5],[-100.3,25.7],[-99.1,19.4]],'Manufactured goods · cross-border rail','Schematic North American land connection, not a railway alignment.'),
 r('europe-rail','European rail corridor','rail',[[4.14,51.95],[6.8,51.4],[8.7,50.1],[8.5,47.4],[9.2,45.5],[8.9,44.4]],'Goods · European land network','Schematic European land corridor.'),
 r('china-asean-rail','China → Southeast Asia','rail',[[102.7,25],[102.6,17.9],[100.5,13.8]],'Goods · regional rail connections','Schematic regional rail/land connection; not a continuous operated rail service.'),
 r('air-pacific','Hong Kong → Los Angeles','air',[[113.92,22.31],[-118.4,33.94]],'Electronics · air cargo','Schematic cargo-hub connection, not a scheduled flight or current aircraft position.'),
 r('air-europe','Shanghai → Frankfurt','air',[[121.8,31.15],[8.57,50.04]],'High-value goods · air cargo','Schematic cargo-hub connection.'),
 r('air-atlantic','Frankfurt → New York','air',[[8.57,50.04],[-73.78,40.64]],'Express & high-value goods','Schematic cargo-hub connection.'),
 r('air-gulf','Dubai → Singapore','air',[[55.36,25.25],[103.99,1.36]],'Express cargo · hub connection','Schematic cargo-hub connection.'),
 r('air-africa','Nairobi → Amsterdam','air',[[36.93,-1.32],[4.76,52.31]],'Perishables · air cargo','Schematic cargo-hub connection.'),
 r('air-southamerica','São Paulo → Miami','air',[[-46.47,-23.43],[-80.29,25.79]],'Perishables & express cargo','Schematic cargo-hub connection.')
];
