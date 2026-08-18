import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';

export class CreateTestDto {
  @IsString()
  @IsNotEmpty({ message: 'title is required' })
  title!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7200, { message: 'duration_seconds cannot exceed 7200 (2 hours)' })
  duration_seconds!: number;

  @IsArray({ message: 'question_ids must be an array' })
  @ArrayMinSize(1, { message: 'question_ids must contain at least one entry' })
  @IsString({ each: true })
  question_ids!: string[];
}
