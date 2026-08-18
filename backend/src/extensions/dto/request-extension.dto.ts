import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class RequestExtensionDto {
  @IsString()
  @IsNotEmpty({ message: 'attempt_id is required' })
  attempt_id!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  requested_seconds?: number;
}
