export interface Category {
  idCategory?: number;
  nameCategory: string;
  status: string;
  listSubC: SubCategory[];
}
export interface SubCategory {
  subId?: number;
  nombre: string;
  status?: string;
  categoryId?: number | null;
}
