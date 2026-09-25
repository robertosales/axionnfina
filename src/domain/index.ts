/**
 * Domain Layer - Regras de negócio puras
 *
 * Este módulo contém entidades, enums, schemas Zod e algoritmos
 * que NÃO dependem de nenhuma infraestrutura externa (banco, API, React).
 *
 * Regras:
 * - Zero imports de @/integrations/*
 * - Zero imports de @/infrastructure/*
 * - Zero imports de React ou hooks
 * - Apenas imports de zod e módulos internos do domain
 */

// Shared domain (enums, entities, schemas)
export * from "@/shared/domain";

// Finance domain
export * from "./finance";

// Investment domain
export * from "./investment";
