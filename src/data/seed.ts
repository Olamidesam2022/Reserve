import type { Plan, Role } from '../engine/types';
import { ROLES } from '../engine/types';
export const champions: Record<string, { name: string; roles: Role[]; art: string }> = {
  Aatrox:{name:'Aatrox',roles:['Top'],art:'266'}, Vi:{name:'Vi',roles:['Jungle'],art:'254'}, Ahri:{name:'Ahri',roles:['Mid'],art:'103'}, Orianna:{name:'Orianna',roles:['Mid'],art:'61'}, Syndra:{name:'Syndra',roles:['Mid'],art:'134'}, Jinx:{name:'Jinx',roles:['Bot'],art:'222'}, Ashe:{name:'Ashe',roles:['Bot','Support'],art:'22'}, Nautilus:{name:'Nautilus',roles:['Support'],art:'111'}, Renata:{name:'Renata Glasc',roles:['Support'],art:'888'}, Gnar:{name:'Gnar',roles:['Top'],art:'150'}, Sejuani:{name:'Sejuani',roles:['Jungle','Top'],art:'113'}, LeeSin:{name:'Lee Sin',roles:['Jungle'],art:'64'}, Leona:{name:'Leona',roles:['Support'],art:'89'}, KaiSa:{name:"Kai'Sa",roles:['Bot'],art:'145'}, Rumble:{name:'Rumble',roles:['Top','Mid'],art:'68'}, Taliyah:{name:'Taliyah',roles:['Mid','Jungle'],art:'163'}, Caitlyn:{name:'Caitlyn',roles:['Bot'],art:'51'}, Lulu:{name:'Lulu',roles:['Support'],art:'117'}, Karthus:{name:'Karthus',roles:['Jungle','Mid'],art:'30'}, Poppy:{name:'Poppy',roles:['Top','Support'],art:'78'}
};
const rating = (ids: string[]) => Object.fromEntries(ids.map((id,i)=>[id, 5 - i % 3]));
const player = (team: string, role: Role, ids: string[]) => ({playerId:`${team}-${role.toLowerCase()}`,role,comfort:rating(ids)});
const blue = {id:'blue',name:'NORTHSTAR',players:[player('blue','Top',['Aatrox','Gnar','Rumble','Poppy']),player('blue','Jungle',['Vi','Sejuani','LeeSin','Taliyah']),player('blue','Mid',['Ahri','Orianna','Syndra','Taliyah','Rumble']),player('blue','Bot',['Jinx','KaiSa','Ashe','Caitlyn']),player('blue','Support',['Nautilus','Renata','Leona','Lulu','Ashe'])]};
const red = {id:'red',name:'IRONCLAD',players:[player('red','Top',['Gnar','Aatrox','Poppy','Rumble']),player('red','Jungle',['Sejuani','LeeSin','Karthus','Vi']),player('red','Mid',['Syndra','Orianna','Taliyah','Ahri','Karthus']),player('red','Bot',['KaiSa','Caitlyn','Jinx','Ashe']),player('red','Support',['Leona','Lulu','Nautilus','Renata','Poppy'])]};
export const seedPlan: Plan = {id:'plan-a',name:'Plan A',series:{format:'bo5',teams:[blue,red],games:ROLES.length ? [1,2,3,4,5].map(index=>({index,bluePicks:{},redPicks:{},bans:[],lockedBefore:new Set<string>()})) : []},intendedPicks:{1:[{teamId:'blue',role:'Mid',championId:'Ahri'},{teamId:'blue',role:'Jungle',championId:'Vi'},{teamId:'red',role:'Mid',championId:'Syndra'}],2:[{teamId:'blue',role:'Bot',championId:'Jinx'},{teamId:'red',role:'Jungle',championId:'Sejuani'}],3:[{teamId:'blue',role:'Top',championId:'Aatrox'},{teamId:'blue',role:'Support',championId:'Nautilus'},{teamId:'red',role:'Bot',championId:'KaiSa'}],4:[{teamId:'blue',role:'Mid',championId:'Orianna'},{teamId:'red',role:'Support',championId:'Leona'}],5:[{teamId:'blue',role:'Jungle',championId:'Sejuani'},{teamId:'red',role:'Top',championId:'Gnar'}]}};
function hydratePicks(plan: Plan): Plan {
  return { ...plan, series: { ...plan.series, games: plan.series.games.map(game => {
    const bluePicks: Partial<Record<Role, string>> = {};
    const redPicks: Partial<Record<Role, string>> = {};
    for (const pick of plan.intendedPicks[game.index] ?? []) (pick.teamId === plan.series.teams[0].id ? bluePicks : redPicks)[pick.role] = pick.championId;
    return { ...game, bluePicks, redPicks };
  }) } };
}
export const seedPlans: Plan[] = [
  seedPlan,
  {...seedPlan,id:'plan-b',name:'Plan B · Mid flex',intendedPicks:{...seedPlan.intendedPicks,1:seedPlan.intendedPicks[1].map(p=>p.teamId==='blue'&&p.role==='Mid'?{...p,championId:'Taliyah'}:p)}},
  {...seedPlan,id:'plan-c',name:'Plan C · Late carry',intendedPicks:{...seedPlan.intendedPicks,1:seedPlan.intendedPicks[1].map(p=>p.teamId==='blue'&&p.role==='Mid'?{...p,championId:'Orianna'}:p)}}
].map(hydratePicks);
