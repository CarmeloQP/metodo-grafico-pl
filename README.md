# Método gráfico de programación lineal

Aplicación web para resolver problemas de programación lineal con dos variables (x₁, x₂) mediante el método gráfico. Muestra la solución paso a paso: planteamiento, rectas de las restricciones, región factible, vértices y óptimo.

## Cómo ejecutarla

No necesita instalación ni servidor. Hay dos formas:

1. Abrir `index.html` con doble clic en cualquier navegador (Chrome, Edge, Firefox).
2. Publicarla en GitHub Pages u otro hosting estático, subiendo la carpeta tal cual.

Con internet se carga la tipografía de Google Fonts; sin conexión funciona igual con una fuente del sistema.

## Funcionalidades

- Función objetivo para maximizar o minimizar.
- Hasta 8 restricciones con signo ≤, ≥ o =, cada una con un nombre opcional.
- Condición de no negatividad (x₁, x₂ ≥ 0) activable.
- Recorrido en 5 pasos con explicación generada a partir de los datos ingresados:
  1. Planteamiento del modelo.
  2. Cortes de cada recta con los ejes.
  3. Prueba del origen y región factible.
  4. Vértices de la región.
  5. Recta objetivo desplazable con un deslizador hasta el óptimo.
- Tabla de vértices con el valor de Z en cada uno.
- Detección de casos especiales: óptimos múltiples, solución no acotada y problema infactible.
- Resultados como fracción exacta cuando es posible (por ejemplo 8/3 ≈ 2.67).
- Ejemplos precargados y diseño adaptable a celular.

## Estructura del proyecto

```
metodo-grafico-pl/
├── index.html        Estructura de la página
├── css/
│   └── estilos.css   Estilos (tablero, cuaderno, nota de respuesta)
└── js/
    ├── solver.js     Algoritmo del método gráfico y formato de números
    ├── grafica.js    Dibujo del plano cartesiano en SVG
    └── app.js        Interfaz, pasos, explicaciones y resultados
```

## Algoritmo (js/solver.js)

1. Cada restricción `a·x₁ + b·x₂ (≤, ≥, =) r` se expresa como semiplanos de la forma `h·x ≤ k`. Las de tipo ≥ se multiplican por −1 y las igualdades generan dos semiplanos.
2. Se calculan las intersecciones de todas las rectas frontera tomadas de dos en dos (incluidos los ejes si x₁, x₂ ≥ 0) con la regla de Cramer.
3. Los puntos que cumplen todas las restricciones son los vértices de la región factible.
4. Se evalúa Z en cada vértice y se elige el mayor (maximizar) o el menor (minimizar).
5. Para saber si la solución es no acotada se buscan direcciones `d` en las que la región se extiende sin límite (`h·d ≤ 0` para todos los semiplanos) y se revisa si Z mejora en alguna de ellas.
6. Si varios vértices empatan en el valor óptimo, se informa que hay óptimos múltiples.

La región factible se dibuja recortando el rectángulo visible con cada semiplano (algoritmo de Sutherland–Hodgman).

## Tecnologías

HTML5, CSS3 y JavaScript sin librerías externas. La gráfica se dibuja con SVG.
