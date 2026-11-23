module async_fifo(input wclk, input rclk, input wrst, input rrst, input winc, input [7:0] wdata, output wfull,
                  input rinc, output [7:0] rdata, output rempty);
  reg [7:0] mem0, mem1, mem2, mem3;
  reg [2:0] wbin, rbin, wgray, rgray;   // 2 address bits + 1 wrap bit
  reg [2:0] rq1, rq2;                   // rgray into wclk
  reg [2:0] wq1, wq2;                   // wgray into rclk
  reg wfull_r, rempty_r;
  wire [2:0] wbin_n = wbin + {2'b0, winc & ~wfull_r}, wgray_n = wbin_n ^ (wbin_n >> 1);
  wire [2:0] rbin_n = rbin + {2'b0, rinc & ~rempty_r}, rgray_n = rbin_n ^ (rbin_n >> 1);
  always @(posedge wclk) begin
    if (wrst) begin wbin <= 0; wgray <= 0; rq1 <= 0; rq2 <= 0; wfull_r <= 0; end
    else begin
      wbin <= wbin_n; wgray <= wgray_n; rq1 <= rbin; rq2 <= rq1;
      wfull_r <= (wbin_n == {~rq2[2], rq2[1:0]});
    end
    if (winc & ~wfull_r) case (wbin[1:0]) 0: mem0 <= wdata; 1: mem1 <= wdata; 2: mem2 <= wdata; default: mem3 <= wdata; endcase
  end
  always @(posedge rclk) begin
    if (rrst) begin rbin <= 0; rgray <= 0; wq1 <= 0; wq2 <= 0; rempty_r <= 1; end
    else begin
      rbin <= rbin_n; rgray <= rgray_n; wq1 <= wbin; wq2 <= wq1;
      rempty_r <= (rbin_n == wq2);
    end
  end
  assign wfull = wfull_r, rempty = rempty_r;
  assign rdata = rbin[1:0] == 0 ? mem0 : rbin[1:0] == 1 ? mem1 : rbin[1:0] == 2 ? mem2 : mem3;
endmodule
