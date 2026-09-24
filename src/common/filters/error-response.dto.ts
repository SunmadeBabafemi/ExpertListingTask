import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FieldErrorDto {
  @ApiProperty({ example: 'location.lat' }) field: string;
  @ApiProperty({ example: ['lat must be a latitude string or number'] })
  messages: string[];
}

/** Swagger model of `ResponseObject.Error(...)`, the body of every non-2xx response. */
export class ErrorResponseDto {
  @ApiProperty({ example: 'failed' }) status: 'failed';
  @ApiProperty({ example: false }) success: false;
  @ApiProperty({ example: 'Bad Request' }) error: string;
  @ApiProperty({ example: 'Validation failed' }) message: string;
  @ApiProperty({ example: 400 }) errorCode: number;
  @ApiPropertyOptional({ type: [FieldErrorDto] }) errors?: FieldErrorDto[];
}
