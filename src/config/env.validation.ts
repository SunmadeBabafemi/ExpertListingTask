import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

const toBoolean = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.toLowerCase() === 'true' : value;

/**
 * Validates process.env at boot so misconfiguration fails fast instead of
 * surfacing as an obscure runtime error on the first request.
 */
export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 3000;

  @IsString()
  DATABASE_URL: string;

  @Transform(toBoolean)
  @IsBoolean()
  DB_SSL = false;

  @Transform(toBoolean)
  @IsBoolean()
  DB_LOGGING = false;

  /** When unset, an in-process cache is used (fine for dev/tests, not for multi-instance deploys). */
  @IsOptional()
  @IsString()
  REDIS_URL?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  CACHE_TTL_SECONDS = 60;
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    exposeDefaultValues: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    const details = errors
      .map(
        (e) =>
          `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`,
      )
      .join('\n  ');
    throw new Error(`Invalid environment configuration:\n  ${details}`);
  }
  return validated;
}
