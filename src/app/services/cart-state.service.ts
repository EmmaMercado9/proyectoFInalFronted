import { inject, Injectable, Signal } from '@angular/core';
import { signalSlice } from 'ngxtension/signal-slice';
import { StorageService } from './storage.service';
import { map, Observable } from 'rxjs';
import { state } from '@angular/animations';

interface State {
  loaded: boolean;
}
@Injectable({
  providedIn: 'root',
})
export class CartStateService {
  private _storageService = inject(StorageService);
  private initalState: State = {
    loaded: false,
  };

  /*loadProducts$ = this._storageService
    .loadProduct()
    .pipe(map((products) => ({ products, loaded: true })));
  state = signalSlice({
    initialState: this.initalState,
    sources: [this.loadProducts$],
    actionSources: {
      add: (state, action$: Observable<ProductItemCart>) =>
        action$.pipe(map((product) => this.add(state, product))),
    },
    effects: (state) => ({
      load: () => {
        if (state().loaded) {
          this._storageService.saveProducts(state().products);
        }
      },
    }),
  });

  private add(state: Signal<State>, product: ProductItemCart) {
    const isInCart = state().products.find(
      (productInCart) =>
        productInCart.product.idProduct === product.product.idProduct
    );
    if (!isInCart) {
      return {
        products: [...state().products, { ...product, quantity: 1 }],
      };
    }
    isInCart.quantity += 1;
    return {
      products: [...state().products],
    };
  }
  // private cargarCarrito() {
  //   if (typeof localStorage !== 'undefined') {
  //     const data = localStorage.getItem('carrito');
  //     this.listCarrito = data ? JSON.parse(data) : [];
  //   } else {
  //     this.listCarrito = [];
  //   }
  //   this.syncWithCatalog();
  // }

  // private guardarCarrito() {
  //   if (typeof localStorage !== 'undefined') {
  //     localStorage.setItem('carrito', JSON.stringify(this.listCarrito));
  //   }
  // }
  // private syncWithCatalog() {
  //   const ids = this.listCarrito.map((item) => item.producto.idProduct);

  //   // Consultar los productos disponibles en el catálogo
  //   this.productService.getProductsByIds(ids).subscribe((products) => {
  //     this.listCarrito = this.listCarrito.filter((item) => {
  //       const productInCatalog = products.find(
  //         (p) => p.idProduct === item.producto.idProduct
  //       );

  //       if (productInCatalog) {
  //         // Actualizar el precio o información del producto si ha cambiado
  //         item.producto.price = productInCatalog.price;
  //         return true;
  //       }

  //       // Eliminar el producto del carrito si ya no está disponible
  //       return false;
  //     });

  //     // Guardar los cambios en el localStorage
  //     this.guardarCarrito();
  //   });
  // }*/
}
