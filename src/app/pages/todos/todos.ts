import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { auth, db } from '../../firebase-init';
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';

type TodoFilter = 'today' | 'upcoming' | 'completed' | 'all';
type TodoPriority = 'low' | 'medium' | 'high';

interface Todo {
  id: string;
  text: string;
  done: boolean;
  dueDate: string; // YYYY-MM-DD
  priority: TodoPriority;
}

interface DailyTask {
  id: string;
  text: string;
  priority: TodoPriority;
  userId: string;
  createdAt: any;
}

@Component({
  selector: 'app-todos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './todos.html',
  styleUrl: './todos.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TodosComponent implements OnInit {
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  todos: Todo[] = [];
  dailyTasks: DailyTask[] = [];

  newTodo: string = '';
  newDueDate: string = this.getToday();
  newPriority: TodoPriority = 'medium';

  newDailyTask: string = '';
  newDailyPriority: TodoPriority = 'medium';
  showDailyTaskForm: boolean = false;

  userId: string | null = null;
  loading: boolean = true;

  userName: string = '';
  greeting: string = '';
  filter: TodoFilter = 'today';

  isDarkMode: boolean = false;

  ngOnInit(): void {
    // restore dark mode preference
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('todo-dark-mode');
      this.isDarkMode = stored === 'true';
    }

    onAuthStateChanged(auth, (user) => {
      if (!user) {
        this.router.navigate(['/login']);
        return;
      }

      // TODO: Re-enable email verification check once testing is complete
      // if (!user.emailVerified) {
      //   this.router.navigate(['/login']);
      //   return;
      // }

      this.userId = user.uid;
      this.userName = user.displayName || user.email?.split('@')[0] || 'Friend';
      this.greeting = this.buildGreeting(this.userName);

      this.loadTodos();
      this.loadDailyTasks();
    });
  }

  private getToday(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private buildGreeting(name: string): string {
    const h = new Date().getHours();
    const period = h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
    const first = name.split(' ')[0] || name;
    return `Good ${period}, ${first}. Let’s make today count ✨`;
  }

  toggleDarkMode() {
    this.isDarkMode = !this.isDarkMode;
    if (typeof window !== 'undefined') {
      localStorage.setItem('todo-dark-mode', String(this.isDarkMode));
    }
    this.cdr.markForCheck();
  }

  // ---------- DAILY TASKS ----------

  async loadDailyTasks() {
    if (!this.userId) return;

    try {
      const dailyTasksRef = collection(db, 'dailyTasks');
      const q = query(dailyTasksRef, where('userId', '==', this.userId));
      const snap = await getDocs(q);

      this.dailyTasks = snap.docs.map((d) => {
        const data: any = d.data();
        return {
          id: d.id,
          text: data['text'] ?? '',
          priority: (data['priority'] as TodoPriority) || 'medium',
          userId: data['userId'] ?? '',
          createdAt: data['createdAt'],
        };
      });

      // Auto-populate daily tasks for today
      await this.populateDailyTasksForToday();
      this.cdr.markForCheck();
    } catch (e) {
      console.error('Error loading daily tasks:', e);
    }
  }

  private async populateDailyTasksForToday() {
    if (!this.userId) return;

    const today = this.getToday();
    const storageKey = `daily-tasks-populated-${today}`;

    // Check if we already populated daily tasks today
    if (typeof window !== 'undefined') {
      const alreadyPopulated = localStorage.getItem(storageKey);
      if (alreadyPopulated === 'true') {
        return; // Already added today, don't duplicate
      }
    }

    try {
      // Add each daily task as a todo for today
      for (const dailyTask of this.dailyTasks) {
        await addDoc(collection(db, 'todos'), {
          userId: this.userId,
          text: dailyTask.text,
          done: false,
          dueDate: today,
          priority: dailyTask.priority,
          createdAt: serverTimestamp(),
          isFromDailyTask: true,
        });
      }

      // Mark that we've populated for today
      if (typeof window !== 'undefined') {
        localStorage.setItem(storageKey, 'true');
      }

      // Reload todos to show the newly added daily tasks
      await this.loadTodos();
    } catch (e) {
      console.error('Error populating daily tasks:', e);
    }
  }

  async addDailyTask() {
    if (!this.newDailyTask.trim()) {
      return;
    }
    if (!this.userId) {
      alert('You are not logged in.');
      return;
    }

    try {
      // capture values before clearing the form
      const text = this.newDailyTask.trim();
      const priority = this.newDailyPriority || 'medium';

      // create the daily task record
      await addDoc(collection(db, 'dailyTasks'), {
        userId: this.userId,
        text,
        priority,
        createdAt: serverTimestamp(),
      });

      // reset the UI form
      this.newDailyTask = '';
      this.newDailyPriority = 'medium';
      this.showDailyTaskForm = false;

      // Reload daily tasks
      await this.loadDailyTasks();

      // Also add today's occurrence immediately using captured values
      const today = this.getToday();
      try {
        await addDoc(collection(db, 'todos'), {
          userId: this.userId,
          text,
          done: false,
          dueDate: today,
          priority,
          createdAt: serverTimestamp(),
          isFromDailyTask: true,
        });
      } catch (innerErr) {
        // non-blocking: still continue if creating today's todo fails
        console.warn("Could not create today's todo for new daily task:", innerErr);
      }

      // Refresh todos to show the new item
      await this.loadTodos();
      this.cdr.markForCheck();
    } catch (e) {
      console.error('Error adding daily task:', e);
      alert('Could not add daily task. Check console for details.');
    }
  }

  async removeDailyTask(dailyTask: DailyTask) {
    try {
      await deleteDoc(doc(db, 'dailyTasks', dailyTask.id));
      await this.loadDailyTasks();
      this.cdr.markForCheck();
    } catch (e) {
      console.error('Error deleting daily task:', e);
    }
  }

  toggleDailyTaskForm() {
    this.showDailyTaskForm = !this.showDailyTaskForm;
    this.cdr.markForCheck();
  }

  // ---------- LOAD TODOS ----------

  async loadTodos() {
    if (!this.userId) {
      console.warn('loadTodos: userId not set');
      return;
    }

    this.loading = true;
    console.log('loadTodos: starting load for userId:', this.userId);
    try {
      const todosRef = collection(db, 'todos');
      const q = query(todosRef, where('userId', '==', this.userId));
      console.log('loadTodos: query created, fetching docs...');
      const snap = await getDocs(q);
      console.log('loadTodos: got', snap.docs.length, 'documents');

      const today = this.getToday();

      this.todos = snap.docs.map((d) => {
        const data: any = d.data();

        let dueDate: string = data['dueDate'] || today;
        const done: boolean = !!data['done'];
        const priority: TodoPriority =
          (data['priority'] as TodoPriority) || 'medium';

        // soft auto-carry to today in UI for unfinished overdue tasks
        if (!done && dueDate < today) {
          dueDate = today;
        }

        return {
          id: d.id,
          text: data['text'] ?? '',
          done,
          dueDate,
          priority,
        };
      });
      console.log('loadTodos: successfully loaded todos:', this.todos);
    } catch (e) {
      console.error('Error loading todos:', e);
      alert('Error loading todos. Check browser console for details: ' + String(e));
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  // ---------- FILTERED VIEW ----------

  get filteredTodos(): Todo[] {
    const today = this.getToday();

    switch (this.filter) {
      case 'today':
        return this.todos.filter((t) => !t.done && t.dueDate === today);
      case 'upcoming':
        return this.todos.filter((t) => !t.done && t.dueDate > today);
      case 'completed':
        return this.todos.filter((t) => t.done);
      default:
        return this.todos;
    }
  }

  setFilter(filter: TodoFilter) {
    this.filter = filter;
    this.cdr.markForCheck();
  }

  isToday(todo: Todo): boolean {
    return todo.dueDate === this.getToday();
  }

  isOverdue(todo: Todo): boolean {
    return !todo.done && todo.dueDate < this.getToday();
  }

  // ---------- STATS ----------

  get todayTasksCount(): number {
    const today = this.getToday();
    return this.todos.filter((t) => t.dueDate === today && !t.done).length;
  }

  get completedCount(): number {
    return this.todos.filter((t) => t.done).length;
  }

  get highPriorityCount(): number {
    return this.todos.filter((t) => !t.done && t.priority === 'high').length;
  }

  // ---------- MUTATIONS ----------

  async addTodo() {
    console.log('addTodo called', {
      text: this.newTodo,
      userId: this.userId,
      dueDate: this.newDueDate,
      priority: this.newPriority,
    });

    if (!this.newTodo.trim()) {
      return;
    }
    if (!this.userId) {
      alert('You are not logged in. Please login again.');
      return;
    }

    const dueDate = this.newDueDate || this.getToday();
    const priority = this.newPriority || 'medium';

    try {
      await addDoc(collection(db, 'todos'), {
        userId: this.userId,
        text: this.newTodo.trim(),
        done: false,
        dueDate,
        priority,
        createdAt: serverTimestamp(),
      });

      this.newTodo = '';
      this.newDueDate = dueDate;
      this.newPriority = 'medium';

      await this.loadTodos();
      this.cdr.markForCheck();
    } catch (e) {
      console.error('Error adding todo:', e);
      alert(
        'Could not add task. Check browser console for the Firebase error message.'
      );
    }
  }

  async toggle(todo: Todo) {
    try {
      await updateDoc(doc(db, 'todos', todo.id), {
        done: !todo.done,
      });
      await this.loadTodos();
      this.cdr.markForCheck();
    } catch (e) {
      console.error('Error updating todo:', e);
    }
  }

  async remove(todo: Todo) {
    try {
      await deleteDoc(doc(db, 'todos', todo.id));
      await this.loadTodos();
      this.cdr.markForCheck();
    } catch (e) {
      console.error('Error deleting todo:', e);
    }
  }

  async logout() {
    await signOut(auth);
    this.router.navigate(['/login']);
  }
}
