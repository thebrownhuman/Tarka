import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class GotoQuestionDto {
  @IsString()
  @IsNotEmpty({ message: 'attempt_id is required' })
  attempt_id!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  position!: number;
}
