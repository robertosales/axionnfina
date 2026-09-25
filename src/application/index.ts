/**
 * Application Layer - Casos de uso e orquestração
 *
 * Este módulo contém a lógica de aplicação que orquestra
 * domain e infrastructure. Usa injeção de dependência.
 *
 * Regras:
 * - Imports de @/domain/ (regras de negócio)
 * - Imports de @/infrastructure/ (clientes, adaptadores)
 * - NÃO importa React ou hooks diretamente
 * - Usa injeção de dependência para infraestrutura
 */

export * from "./transactions";
