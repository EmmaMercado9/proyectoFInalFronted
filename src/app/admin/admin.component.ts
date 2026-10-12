import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import {
  Router,
  RouterLinkActive,
  RouterLink,
  RouterOutlet,
} from '@angular/router';
import { UserService } from '../services/user.service';
import { Observable, catchError, of, shareReplay, startWith } from 'rxjs';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [RouterOutlet, RouterLink, CommonModule, RouterLinkActive],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css',
})
export class AdminComponent implements OnInit {
  private _user = inject(UserService);
  private router = inject(Router);

  // El COLABORADOR ve POS, ventas, clientes e inventario (solo lectura)
  readonly esAdmin = this._user.isAdmin();
  showSidebar = false;
  showMenu = false;
  estadOpenV = false;
  estadOpenUser = false;
  estadOpenProd = false;
  usuario$!: Observable<any>;

  ngOnInit(): void {
    // Una sola petición compartida por todos los `| async` del template;
    // mientras llega se muestra el usuario guardado en el login.
    this.usuario$ = this._user.getUserCurrent().pipe(
      startWith(this._user.getUser()),
      catchError(() => of(this._user.getUser())),
      shareReplay(1)
    );

    // Abrir el grupo del menú que corresponde a la ruta actual
    const url = this.router.url;
    this.estadOpenUser = url.startsWith('/admin/users');
    this.estadOpenV = /^\/admin\/(orders|clients|pos|carrito|comprobante|devoluciones)/.test(url);
    this.estadOpenProd = /^\/admin\/(products|productos|formProduct|category)/.test(url);
  }

  sidebar() {
    this.showSidebar = !this.showSidebar;
  }
  show() {
    this.showMenu = !this.showMenu;
  }
  toggleVentas() {
    this.estadOpenV = !this.estadOpenV;
  }
  toggleUsers() {
    this.estadOpenUser = !this.estadOpenUser;
  }
  toggleProductos() {
    this.estadOpenProd = !this.estadOpenProd;
  }

  // Cierra el menú sólo si el foco sale del contenedor (no al hacer click
  // en un botón interno, p. ej. "Cerrar sesión")
  onMenuFocusOut(event: FocusEvent) {
    const container = event.currentTarget as HTMLElement;
    if (!container.contains(event.relatedTarget as Node | null)) {
      this.showMenu = false;
    }
  }

  logout() {
    this._user.logout();
    this.showMenu = false;
    this.showSidebar = false;
    this.router.navigate(['/login']);
  }
}
