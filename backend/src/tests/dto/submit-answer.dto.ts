import { IsArray, IsNotEmpty, IsString } from 'class-validator';

export class SubmitAnswerDto {
  @IsString()
  @IsNotEmpty({ message: 'attempt_id is required' })
  attempt_id!: string;

  @IsString()
  @IsNotEmpty({ message: 'question_id is required' })
  question_id!: string;

  @IsArray({ message: 'selected_option_ids must be an array' })
  @IsString({ each: true })
  selected_option_ids!: string[];
}
