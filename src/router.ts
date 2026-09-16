import { createRouter, createWebHistory } from 'vue-router'
import HomePage from './pages/HomePage.vue'
import IssueDetailPage from './pages/IssueDetailPage.vue'

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomePage },
    { path: '/issue/:slug', component: IssueDetailPage },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})
