import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListQuestionsDto {
  @IsOptional()
  @IsString()
  domain?: string;

  @IsOptional()
  @IsString()
  topic?: string;

  @IsOptional()
  @IsIn(['easy', 'medium', 'hard'], { message: 'difficulty must be one of easy, medium, hard' })
  difficulty?: string;

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
