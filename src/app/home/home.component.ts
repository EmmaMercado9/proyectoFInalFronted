import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { UserService } from '../services/user.service';
import { CartStateService } from '../services/cart-state.service';
import { FootterComponent } from '../footter/footter.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FootterComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent implements OnInit {
  listProducts: any[] = [];
  constructor(
    private router: Router,
    private userService: UserService
  ) {}

  ngOnInit(): void {
    // this.getProductos();
  }

  // getProductos() {
  //   this.service.getProducts().subscribe({
  //     next: (products) => {
  //       this.listProducts = products;
  //     },
  //   });
  // }
}
