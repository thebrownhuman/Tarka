import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';

export class ApproveExtensionDto {
  @IsString()
  @IsNotEmpty({ message: 'request_id is required' })
  request_id!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'granted_seconds must be at least 1' })
  @Max(7200, { message: 'granted_seconds cannot exceed 7200 (2 hours)' })
  granted_seconds!: number;
}
