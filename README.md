# LuzBot

Juego web de programación espacial inspirado en Lightbot: el robot sigue un programa de bloques para encender todas las lámparas del mapa.

## Cómo jugar

```bash
npm install
npm run dev
```

Abre la URL de Vite (por defecto `http://localhost:5173`).

- **Campaña:** 12 niveles con dificultad creciente.
- **Bloques:** avanzar, girar, saltar, luz, procedimiento 1 y 2.
- **Editor:** pinta alturas, lámparas, inicio del robot, comandos permitidos y límites de slots. Los niveles se guardan en el navegador y se pueden exportar/importar en JSON.

## Reglas

- Avanzar solo funciona si la baldosa de delante tiene la **misma altura**.
- Saltar cambia **exactamente un** nivel de altura.
- Luz conmuta la lámpara de la baldosa actual.
- Ganas cuando todas las lámparas están encendidas.
