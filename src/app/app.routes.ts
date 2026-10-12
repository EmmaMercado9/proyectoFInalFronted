import { Routes } from '@angular/router';
import { adminGuard, panelGuard } from './utils/admin.guard';
import { guardRedictLoginGuard } from './utils/guard-redict-login.guard';

// Todas las pantallas se cargan de forma diferida (lazy) para que el bundle
// inicial no incluya el panel de administración completo.
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./main/main.component').then((m) => m.MainComponent),
  },

  // El COLABORADOR ahora trabaja dentro del panel (POS, ventas, clientes)
  { path: 'user', redirectTo: 'admin/pos', pathMatch: 'full' },

  {
    path: 'admin',
    title: 'Panel',
    canActivate: [panelGuard],
    loadComponent: () =>
      import('./admin/admin.component').then((m) => m.AdminComponent),
    children: [
      {
        path: 'category',
        canActivate: [adminGuard],
        title: 'Categorías',
        loadComponent: () =>
          import('./category-admin/category-admin.component').then(
            (m) => m.CategoryAdminComponent
          ),
      },
      {
        path: 'users',
        canActivate: [adminGuard],
        title: 'Usuarios',
        loadComponent: () =>
          import('./userAdmin/list-user/list-user.component').then(
            (m) => m.ListUserComponent
          ),
      },
      {
        path: 'orders',
        title: 'Ventas',
        loadComponent: () =>
          import('./order-list/order-list.component').then(
            (m) => m.OrderListComponent
          ),
      },
      {
        path: 'orders/:trackingId/devolucion',
        title: 'Devolución o cambio',
        loadComponent: () =>
          import('./devolucion/devolucion.component').then(
            (m) => m.DevolucionComponent
          ),
      },
      {
        path: 'facturas/:id',
        title: 'Factura',
        loadComponent: () =>
          import('./factura/factura.component').then((m) => m.FacturaComponent),
      },
      {
        path: 'devoluciones',
        title: 'Devoluciones',
        loadComponent: () =>
          import('./devoluciones-list/devoluciones-list.component').then(
            (m) => m.DevolucionesListComponent
          ),
      },
      {
        path: 'pos',
        title: 'Punto de venta',
        loadComponent: () =>
          import('./pos/pos.component').then((m) => m.PosComponent),
      },
      {
        path: 'clients',
        title: 'Clientes',
        loadComponent: () =>
          import('./list-client/list-client.component').then(
            (m) => m.ListClientComponent
          ),
      },
      {
        path: 'carrito',
        title: 'Carrito',
        loadComponent: () =>
          import('./cart/cart.component').then((m) => m.CartComponent),
      },
      {
        path: 'comprobante/:trackingId',
        title: 'Comprobante',
        loadComponent: () =>
          import('./comprobante/comprobante.component').then(
            (m) => m.ComprobanteComponent
          ),
      },
      {
        path: 'formProduct/:id',
        canActivate: [adminGuard],
        title: 'Producto',
        loadComponent: () =>
          import('./add-product/add-product.component').then(
            (m) => m.AddProductComponent
          ),
      },
      {
        path: 'products',
        title: 'Inventario',
        loadComponent: () =>
          import('./listProduct/product-list/product-list.component').then(
            (m) => m.ProductListComponent
          ),
      },
      {
        path: 'productos/:id',
        title: 'Detalle de producto',
        loadComponent: () =>
          import('./detail-product/detail-product.component').then(
            (m) => m.DetailProductComponent
          ),
      },
    ],
  },

  {
    path: 'login',
    title: 'Iniciar sesión',
    pathMatch: 'full',
    canActivate: [guardRedictLoginGuard],
    loadComponent: () =>
      import('./singin/singin.component').then((m) => m.SinginComponent),
  },

  { path: '**', redirectTo: '', pathMatch: 'full' },
];
