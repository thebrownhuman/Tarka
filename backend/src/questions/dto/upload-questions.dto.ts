import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class QuestionOptionDto {
  @IsString()
  @IsNotEmpty({ message: 'id is required' })
  id!: string;

  @IsString()
  @IsNotEmpty({ message: 'text is required' })
  text!: string;
}

export class UploadQuestionDto {
  @IsString()
  @IsNotEmpty({ message: 'domain is required' })
  domain!: string;

  @IsString()
  @IsNotEmpty({ message: 'topic is required' })
  topic!: string;

  @IsOptional()
  @IsString()
  subpattern?: string;

  @IsIn(['easy', 'medium', 'hard'], { message: 'difficulty must be one of easy, medium, hard' })
  difficulty!: string;

  @IsIn(['single_choice', 'multi_choice'], { message: 'question_type must be one of single_choice, multi_choice' })
  question_type!: string;

  @IsOptional()
  @IsString()
  passage_id?: string;

  @IsOptional()
  @IsString()
  passage_text?: string;

  @IsString()
  @IsNotEmpty({ message: 'question_text is required' })
  question_text!: string;

  @IsOptional()
  @IsString()
  image_url?: string;

  @IsArray({ message: 'options must be an array' })
  @ArrayMinSize(1, { message: 'options must contain at least one entry' })
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  options!: QuestionOptionDto[];

  @IsArray({ message: 'correct_option_ids must be an array' })
  @ArrayMinSize(1, { message: 'correct_option_ids must contain at least one entry' })
  @IsString({ each: true })
  correct_option_ids!: string[];

  @IsString()
  @IsNotEmpty({ message: 'explanation is required' })
  explanation!: string;
}

export class UploadQuestionsDto {
  @IsArray({ message: 'questions must be an array' })
  @ArrayMinSize(1, { message: 'questions must contain at least one entry' })
  @ValidateNested({ each: true })
  @Type(() => UploadQuestionDto)
  questions!: UploadQuestionDto[];
}
