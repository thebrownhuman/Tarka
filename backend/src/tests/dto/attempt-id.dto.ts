import { IsNotEmpty, IsString } from 'class-validator';

export class AttemptIdDto {
  @IsString()
  @IsNotEmpty({ message: 'attempt_id is required' })
  attempt_id!: string;
}
