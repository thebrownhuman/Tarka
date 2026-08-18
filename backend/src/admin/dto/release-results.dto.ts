import { IsNotEmpty, IsString } from 'class-validator';

export class ReleaseResultsDto {
  @IsString()
  @IsNotEmpty({ message: 'attempt_id is required' })
  attempt_id!: string;
}
