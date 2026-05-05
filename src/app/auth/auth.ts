import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './auth.html',
  styleUrl: './auth.scss',
})
export class AuthComponent {
  public username = '';
  public password = '';

  constructor(private router: Router) {}

  public login(): void {
    console.log('Login attempted', {
      username: this.username,
      password: this.password,
    });
    this.router.navigate(['/settings']);
  }

  public loginWithMicrosoft(): void {
    console.log('Login with Microsoft clicked');
    this.router.navigate(['/settings']);
  }
}
