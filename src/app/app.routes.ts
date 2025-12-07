import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login';
import { TodosComponent } from './pages/todos/todos';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'todos', component: TodosComponent },
];
