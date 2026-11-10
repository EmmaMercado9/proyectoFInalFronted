/**
 * Achica una foto antes de subirla: las del celular pesan varios MB y no hace
 * falta tanta resolución para mostrar un producto. Queda en JPEG de hasta
 * 1600 px por lado (normalmente entre 200 y 500 KB).
 */
export async function comprimirImagen(file: File, maxLado = 1600, calidad = 0.82): Promise<File> {
  const img = await cargar(file);
  const escala = Math.min(1, maxLado / Math.max(img.naturalWidth, img.naturalHeight));
  const ancho = Math.round(img.naturalWidth * escala);
  const alto = Math.round(img.naturalHeight * escala);

  const canvas = document.createElement('canvas');
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff'; // los PNG transparentes quedan con fondo blanco
  ctx.fillRect(0, 0, ancho, alto);
  ctx.drawImage(img, 0, 0, ancho, alto);

  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', calidad));
  if (!blob) throw new Error('No se pudo procesar la imagen');
  // Si ya era chica y liviana, se deja como estaba
  if (escala === 1 && blob.size >= file.size && file.type !== 'image/heic') return file;

  const nombre = file.name.replace(/\.[^.]+$/, '') + '.jpg';
  return new File([blob], nombre, { type: 'image/jpeg', lastModified: file.lastModified });
}

function cargar(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Formato de imagen no soportado'));
    };
    img.src = url;
  });
}
