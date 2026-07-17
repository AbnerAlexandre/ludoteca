import type { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth.guard';

/**
 * Every feature is lazy: the login screen shouldn't ship the group-aggregation
 * view. Paths are in Portuguese to match the audience and the Ludopedia domain.
 */
export const routes: Routes = [
  {
    path: 'entrar',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login.page').then((m) => m.LoginPage),
    title: 'Entrar · Ludoteca',
  },
  {
    path: 'criar-conta',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/register.page').then((m) => m.RegisterPage),
    title: 'Criar conta · Ludoteca',
  },
  {
    path: '',
    loadComponent: () => import('./shell/app-shell').then((m) => m.AppShell),
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'colecao' },
      {
        path: 'colecao',
        loadComponent: () => import('./features/lists/lists.page').then((m) => m.ListsPage),
        title: 'Minhas listas · Ludoteca',
      },
      {
        path: 'listas/:listId',
        loadComponent: () => import('./features/lists/list-detail.page').then((m) => m.ListDetailPage),
        title: 'Lista · Ludoteca',
      },
      {
        path: 'buscar',
        loadComponent: () => import('./features/games/search.page').then((m) => m.SearchPage),
        title: 'Buscar jogos · Ludoteca',
      },
      {
        path: 'amigos',
        loadComponent: () => import('./features/social/friends.page').then((m) => m.FriendsPage),
        title: 'Amigos · Ludoteca',
      },
      {
        path: 'grupos',
        loadComponent: () => import('./features/social/groups.page').then((m) => m.GroupsPage),
        title: 'Grupos · Ludoteca',
      },
      {
        path: 'grupos/:groupId',
        loadComponent: () => import('./features/social/group-detail.page').then((m) => m.GroupDetailPage),
        title: 'Grupo · Ludoteca',
      },
      {
        path: 'emprestimos',
        loadComponent: () => import('./features/social/loans.page').then((m) => m.LoansPage),
        title: 'Empréstimos · Ludoteca',
      },
      {
        path: 'conta',
        loadComponent: () => import('./features/account/account.page').then((m) => m.AccountPage),
        title: 'Conta · Ludoteca',
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
