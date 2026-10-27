"""
Capas de Proli en alta para los videos (proli-cuerpo@4x.png y proli-brazo@4x.png), recortadas del
dibujo original (1907 × 1884, la misma proporción que las capas de la app de 480 × 474):
  - el brazo: desde el hombro hacia afuera, terminado en media luna alrededor del hombro
  - el cuerpo: todo lo demás, con un disco en el hombro y la cara lisa (ojos y boca van encima)
Es la articulación clásica de los personajes planos: al girar el brazo sobre el hombro, la media
luna y el disco calzan y la unión no deja cortes. Juntas en reposo dan el original.

Uso:  python scripts/proli-videos/recortar-capas.py <ruta a proli.png original>
"""
import sys, os
from PIL import Image, ImageDraw, ImageChops, ImageFilter

AQUI = os.path.dirname(os.path.abspath(__file__))
orig = Image.open(sys.argv[1]).convert('RGBA')
W, H = orig.size; sx = W / 480; sy = H / 474
VERDE = (137, 187, 133, 255)
oa = orig.getchannel('A')

app = Image.open(os.path.join(AQUI, '..', '..', 'src', 'assets', 'proli-brazo.webp')).getchannel('A')
# Hombro: en el eje del brazo, donde va casi horizontal (de y 266 a 293.5); el radio es medio grosor.
# Mismo hombro que HOMBRO en animaciones.ts
HX, HY, R = 382, 279.7, 13.9
disco = [(HX - R) * sx, (HY - R) * sy, (HX + R) * sx, (HY + R) * sy]
silueta = app.point(lambda v: 255 if v > 20 else 0).resize((W, H), Image.BILINEAR).point(lambda v: 255 if v > 60 else 0).filter(ImageFilter.MaxFilter(13))
ImageDraw.Draw(silueta).rectangle([0, 0, HX * sx, H], fill=0)

# El brazo: desde el hombro hacia afuera, con la punta redonda (media luna alrededor del hombro)
mb = silueta.copy(); ImageDraw.Draw(mb).ellipse(disco, fill=255)
brazo = orig.copy(); brazo.putalpha(ImageChops.multiply(oa, mb))
# El cuerpo: sin el brazo, con un disco en el hombro sobre el que gira (el brazo lo tapa en reposo)
quitar = silueta.copy(); ImageDraw.Draw(quitar).ellipse(disco, fill=0)
cuerpo = orig.copy(); cuerpo.putalpha(ImageChops.multiply(oa, ImageChops.invert(quitar)))
ImageDraw.Draw(cuerpo).ellipse(disco, fill=VERDE)
r = 58
ImageDraw.Draw(cuerpo).ellipse([(203 - r) * sx, (195 - r) * sy, (203 + r) * sx, (195 + r) * sy], fill=VERDE)

cuerpo.save(os.path.join(AQUI, 'proli-cuerpo@4x.png'), optimize=True)
brazo.save(os.path.join(AQUI, 'proli-brazo@4x.png'), optimize=True)
