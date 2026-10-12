// models/product.model.ts
export interface ProductRequest {
  nameProduct: string;
  codigoBarra?: string;
  sku?: string;
  description?: string;
  marca?: string;
  modelo?: string;
  precioVenta: number;
  precioPro?: number;
  costo: number;
  subCategoriaId?: number;
  tieneVariantes: boolean;
  stockInicial?: number;
  stockMinimo?: number;
}

export interface VarianteRequest {
  sku: string;
  codigoBarra?: string;
  precioVenta?: number;
  precioPro?: number;
  costo?: number;
  stock: number;
  stockMinimo?: number;
  atributos: AtributoValorRequest[];
}

export interface AtributoValorRequest {
  atributoId: number;
  valor: string;
}

export interface ProductResponse {
  idProduct: string;
  codigoBarra?: string;
  sku?: string;
  nameProduct: string;
  description?: string;
  marca?: string;
  modelo?: string;
  precioVenta: number;
  precioPro?: number;
  costo: number;
  margen?: number;
  tieneVariantes: boolean;
  status: string;
  stockTotal: number;
  stockBajo: boolean;
  subCategoriaId?: number;
  subCategoriaNombre?: string;
  imageModelSetDto: ImageResponse[];
  variantes: VarianteResponse[];
}

// product.model.ts — actualizar VarianteResponse
export interface VarianteResponse {
  variantId: number;
  sku: string;
  codigoBarra?: string; // ← agregar esta línea
  precioVenta: number; // efectivo: el propio o el del producto
  precioPro?: number;
  costo?: number | null;
  stock: number;
  stockMinimo: number;
  esDefault: boolean;
  status: string;
  atributos: { [key: string]: string };
  descripcion: string;
  imageModelSetDto: ImageResponse[];
}

// ImagenModelDto: `url` ya es la URL absoluta de Cloudinary
export interface ImageResponse {
  id?: number;
  imageId: string; // public_id de Cloudinary
  name: string;
  esPrincipal: boolean;
  url: string;
  idproduct?: string;
}

/** PUT /api/productos/{id} — no incluye tieneVariantes ni stock */
export interface ProductUpdateRequest {
  nameProduct: string;
  codigoBarra?: string;
  sku?: string;
  description?: string;
  marca?: string;
  modelo?: string;
  precioVenta: number;
  precioPro?: number;
  costo: number;
  subCategoriaId?: number;
}

/** PUT /api/productos/variantes/{id} — precios null = hereda del producto */
export interface VarianteUpdateRequest {
  sku: string;
  codigoBarra?: string;
  precioVenta?: number | null;
  precioPro?: number | null;
  costo?: number | null;
  stockMinimo?: number;
}

export interface AtributoResponse {
  atributoId: number;
  nombre: string;
}

export interface CategoryResponse {
  idCategory: number;
  nameCategory: string;
  status: string;
  cantidadSubcategorias: number;
  cantidadProductos: number;
  subCategorias: SubCategoriaResponse[];
}

export interface SubCategoriaResponse {
  subId: number;
  nombre: string;
  status: string;
  categoryId: number;
  categoryNombre?: string;
  cantidadProductos: number;
}

// product.model.ts
export interface ProductListadoDTO {
  idProduct: string;
  nameProduct: string;
  sku?: string;
  marca?: string;
  precioVenta: number;
  stockTotal: number;
  tieneVariantes: boolean;
  cantidadVariantes: number;
  status: string;
  stockBajo: boolean;
  imagenPrincipalUrl?: string; // URL de Cloudinary de la foto principal
}
