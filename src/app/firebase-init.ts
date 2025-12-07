import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyD860c7KVZdLec03tMQTQ92EWxmPkTHulk",
  authDomain: "todo-angular-app-916de.firebaseapp.com",
  projectId: "todo-angular-app-916de",
  storageBucket: "todo-angular-app-916de.firebasestorage.app",
  messagingSenderId: "162974829720",
  appId: "1:162974829720:web:aa98f3a6edfe1e248354ed",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
