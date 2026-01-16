import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, firstValueFrom, throwError } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class PortabilidadeService {
  // Endpoints seguros do servidor (token não fica exposto no cliente)
  private readonly apiBase = 'https://circulooperario192203.datasul.cloudtotvs.com.br/api/appMobileSaude/v1/cartaPortabilidade';

  private readonly apiAuthorization = 'YXBwOkMzRE5JQmpVaHVTVg==';

  constructor(private readonly http: HttpClient) {}

  async listarDeclaracao(chaveUnica: string): Promise<string | null> {

    const url = `${this.apiBase}/listar-declaracoes`;
    
    const body = { chaveUnica };

    const headers = new HttpHeaders({
     Authorization: `basic ${this.apiAuthorization}` ,
     'Content-Type': 'application/json'
   });

    type DeclResponse = { tipoDeclaracoes: Array<{ declaracoes: Array<{ idDeclaracao: string }> }>; mensagem?: string };

    const resp = await firstValueFrom(
      this.http.post<DeclResponse>(url, body, {headers} ).pipe(
        catchError((error: HttpErrorResponse) => {
          if (error.status === 404) {
            return throwError(() => new Error('Beneficiário não encontrado'));
          }
          return throwError(() => error);
        })
      )
    );
    const tipo = resp?.tipoDeclaracoes?.[0];
    const decl = tipo?.declaracoes?.[0];
    return decl?.idDeclaracao ?? null;
  }

  async obterDeclaracaoPdf(chaveUnica: string, idDeclaracao: string): Promise<string | null> {
    const url = `${this.apiBase}/declaracao-pdf`;
    const body = { chaveUnica, idDeclaracao };

    type PdfResponse = { base64?: string; mensagem?: string };
    const resp = await firstValueFrom(
      this.http.post<PdfResponse>(url, body).pipe(
        catchError((error: HttpErrorResponse) => {
          if (error.status === 404) {
            return throwError(() => new Error('Beneficiário não encontrado'));
          }
          return throwError(() => error);
        })
      )
    );
    return resp?.base64 ?? null;
  }
}
