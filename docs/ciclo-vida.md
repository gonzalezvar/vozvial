# Ciclo de vida del prototipo aplicado a VozVial

Este documento registra **lo que se hizo** en cada etapa del ciclo de vida del prototipo, con fecha, decisiones y problemas. No contiene definiciones.

## 1. Recolección de requisitos

### 2026-11-08 · Fase 0 · Plan
- **Qué se hizo:** se leyeron `CLAUDE.md`, `docs/historias-usuario.md` (14 historias, 49 criterios) y `docs/base-normativa.md`. Se inicializó el repositorio git y se escribió `docs/plan.md` con el orden de construcción por historia, 12 riesgos técnicos y su mitigación. Se crearon este documento y `docs/refinamiento-historias.md`.
- **Decisiones:**
  - La base normativa y el dominio se construyen antes que las pantallas, porque casi todas las historias dependen de ellos.
  - Esquema de clave envuelta (clave de datos cifrada con el PIN y con el código de recuperación) para que CA-03.1 sea posible sin perder los casos.
  - Tiempos de bloqueo e inactividad configurables por variable de entorno solo para las pruebas.
- **Problemas:** el reconocimiento de voz del navegador no funciona en todos los navegadores y, en Chrome, el audio lo procesa Google. Se declara en la app y se ofrece siempre la opción de escribir.

## 2. Diseño rápido

## 3. Construcción

## 4. Evaluación

## 5. Refinamiento

## 6. Entrega
