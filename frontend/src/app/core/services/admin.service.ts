import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CandidateListResponse, CreateCandidateResponse } from '../models/candidate.model';
import { AttemptDetailResponse } from '../models/test-attempt.model';
import { AttemptSummary, AttemptSummaryListResponse } from '../models/attempt-summary.model';
import {
  ApproveExtensionResponse,
  DenyExtensionResponse,
  ExtensionRequestListResponse,
  ExtensionRequestStatus,
} from '../models/extension-request.model';
import { AdminQuestionListResponse, QuestionDifficulty, UploadQuestionInput, UploadQuestionsResponse } from '../models/question.model';
import { CreateTestResponse } from '../models/test.model';

const BASE_URL = `${environment.apiBaseUrl}/admin`;

@Injectable({ providedIn: 'root' })
export class AdminService {
  constructor(private readonly http: HttpClient) {}

  // --- Candidates ---

  createCandidate(loginId: string, displayName: string): Observable<CreateCandidateResponse> {
    return this.http.post<CreateCandidateResponse>(`${BASE_URL}/candidates/create`, { loginId, displayName });
  }

  resetPassword(userId: string): Observable<CreateCandidateResponse> {
    return this.http.post<CreateCandidateResponse>(`${BASE_URL}/candidates/reset-password`, { userId });
  }

  listCandidates(offset: number, limit: number): Observable<CandidateListResponse> {
    return this.http.post<CandidateListResponse>(`${BASE_URL}/dashboard/candidates/list`, { offset, limit });
  }

  // --- Attempts ---

  listAttempts(
    filters: { candidateId?: string; testId?: string; status?: string },
    offset: number,
    limit: number,
  ): Observable<AttemptSummaryListResponse> {
    return this.http.post<AttemptSummaryListResponse>(`${BASE_URL}/dashboard/attempts/list`, {
      ...filters,
      offset,
      limit,
    });
  }

  releaseResults(attemptId: string, includeAnswers: boolean): Observable<AttemptSummary> {
    return this.http.post<AttemptSummary>(`${BASE_URL}/dashboard/attempts/release`, { attemptId, includeAnswers });
  }

  getAttemptDetail(attemptId: string): Observable<AttemptDetailResponse> {
    const params = new HttpParams().set('attempt_id', attemptId);
    return this.http.get<AttemptDetailResponse>(`${BASE_URL}/dashboard/attempts/detail`, { params });
  }

  // --- Questions ---

  uploadQuestions(questions: UploadQuestionInput[]): Observable<UploadQuestionsResponse> {
    return this.http.post<UploadQuestionsResponse>(`${BASE_URL}/questions/upload`, { questions });
  }

  listQuestions(
    filters: { domain?: string; topic?: string; difficulty?: QuestionDifficulty },
    offset: number,
    limit: number,
  ): Observable<AdminQuestionListResponse> {
    return this.http.post<AdminQuestionListResponse>(`${BASE_URL}/questions/list`, {
      ...filters,
      offset,
      limit,
    });
  }

  // --- Tests ---

  createTest(title: string, durationSeconds: number, questionIds: string[]): Observable<CreateTestResponse> {
    return this.http.post<CreateTestResponse>(`${BASE_URL}/tests/create`, { title, durationSeconds, questionIds });
  }

  // --- Extension requests ---

  listExtensionRequests(
    status: ExtensionRequestStatus | undefined,
    offset: number,
    limit: number,
  ): Observable<ExtensionRequestListResponse> {
    return this.http.post<ExtensionRequestListResponse>(`${BASE_URL}/extension-requests/list`, { status, offset, limit });
  }

  approveExtension(requestId: string, grantedSeconds: number): Observable<ApproveExtensionResponse> {
    return this.http.post<ApproveExtensionResponse>(`${BASE_URL}/extension-requests/approve`, {
      requestId,
      grantedSeconds,
    });
  }

  denyExtension(requestId: string, adminNote?: string): Observable<DenyExtensionResponse> {
    return this.http.post<DenyExtensionResponse>(`${BASE_URL}/extension-requests/deny`, { requestId, adminNote });
  }
}
