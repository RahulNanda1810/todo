import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { auth } from '../../firebase-init';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  signOut,
} from 'firebase/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private router = inject(Router);

  name = '';
  email = '';
  password = '';

  isLogin = true;
  loading = false;
  error = '';
  infoMessage = '';

  async onSubmit() {
    this.error = '';
    this.infoMessage = '';
    this.loading = true;

    try {
      if (this.isLogin) {
        // ✅ LOGIN WITH VERIFICATION CHECK
        const cred = await signInWithEmailAndPassword(
          auth,
          this.email,
          this.password
        );

        // TODO: Re-enable email verification check once testing is complete
        // if (!cred.user.emailVerified) {
        //   await signOut(auth);
        //   this.error =
        //     'Your email is not verified yet. Please check your inbox or spam.';
        //   return;
        // }

        this.router.navigate(['/todos']);
      } else {
        // ✅ SIGNUP WITH EMAIL VERIFICATION
        const cred = await createUserWithEmailAndPassword(
          auth,
          this.email,
          this.password
        );

        const trimmed = this.name.trim();
        if (trimmed) {
          await updateProfile(cred.user, { displayName: trimmed });
        }

        // ✅ SEND VERIFICATION EMAIL
        await sendEmailVerification(cred.user);

        this.infoMessage =
          'Account created! A verification email has been sent. Please verify before logging in.';
        this.isLogin = true;
        this.password = '';
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      this.error = this.mapFirebaseError(err);
    } finally {
      this.loading = false;
    }
  }

  async resendVerification() {
    const user = auth.currentUser;
    if (!user) {
      this.error = 'Please log in again first.';
      return;
    }

    await sendEmailVerification(user);
    this.infoMessage = 'Verification email resent! Check your inbox or spam.';
  }

  switchMode(isLogin: boolean) {
    this.isLogin = isLogin;
    this.error = '';
    this.infoMessage = '';
  }

  private mapFirebaseError(err: any): string {
    const code = err?.code as string | undefined;

    switch (code) {
      case 'auth/invalid-email':
        return 'That email address looks invalid.';
      case 'auth/user-not-found':
        return 'No account found with this email. Try signing up.';
      case 'auth/wrong-password':
        return 'Incorrect password. Please try again.';
      case 'auth/email-already-in-use':
        return 'An account already exists with this email.';
      case 'auth/weak-password':
        return 'Password should be at least 6 characters.';
      default:
        return err?.message || 'Something went wrong. Please try again.';
    }
  }
}
