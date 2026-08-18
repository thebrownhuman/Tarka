import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListAttemptsDto {
  @IsOptional()
  @IsString()
  candidate_id?: string;

  @IsOptional()
  @IsString()
  test_id?: string;

  @IsOptional()
  @IsIn(['in_progress', 'submitted', 'expired'], {
    message: 'status must be one of in_progress, submitted, expired',
  })
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit: number = 50;
}
