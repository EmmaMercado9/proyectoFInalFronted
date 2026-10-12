import { Component } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { UserService } from '../services/user.service';
import { ErrorHandleService } from '../error/error-handle.service';
import { User } from '../user/interfaces/user.model';

@Component({
  selector: 'app-footter',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './footter.component.html',
  styleUrl: './footter.component.css',
})
export class FootterComponent {
  formUser: FormGroup;

  constructor(
    private router: Router,
    private form: FormBuilder,
    private serviceUser: UserService,
    private errorService: ErrorHandleService
  ) {
    this.formUser = form.group({
      email: ['', Validators.required],
      password: ['', Validators.required],
    });
  }

  onLogin() {
    const newUser: User = {
      email: this.formUser.value.email,
      password: this.formUser.value.password,
    };

    this.serviceUser.generateToken(newUser).subscribe((data: any) => {
      this.serviceUser.loginUser(data.token);
      this.serviceUser.getUserCurrent().subscribe((user: any) => {
        this.serviceUser.setUser(user);
        if (this.serviceUser.getUserRole() == 'ADMIN') {
          this.router.navigate(['/admin']);
        } else if (this.serviceUser.getUserRole() == 'COLABORADOR') {
          this.router.navigate(['/user']);
        } else {
          this.serviceUser.logout();
        }
      });
    });
  }

  subtmit() {}
  hasError(controlName: string, typeError: string) {
    return (
      this.formUser.get(controlName)?.hasError(typeError) &&
      this.formUser.get(controlName)?.touched
    );
  }
}
