import { createRouter,createWebHistory } from 'vue-router'
import Home from './pages/Home.vue'
import Compare from './pages/Compare.vue'
import Explore from './pages/Explore.vue'
import Keyword from './pages/Keyword.vue'
import Info from './pages/Info.vue'
export default createRouter({history:createWebHistory(),scrollBehavior:()=>({top:0}),routes:[
 {path:'/',component:Home},{path:'/trending',component:Explore},
 {path:'/vs',component:Compare},{path:'/vs/:keywordA/:keywordB',component:Compare},
 {path:'/shopping',component:Explore},{path:'/shopping/:keyword',component:Keyword},
 {path:'/search/:keyword',component:Keyword},
 ...['about','methodology','privacy','terms'].map(page=>({path:`/${page}`,component:Info,props:{page}})),
 {path:'/issue/:slug',redirect:'/trending'},
 {path:'/:pathMatch(.*)*',component:Info,props:{page:'404'}}
]})
