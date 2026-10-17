// tiny8: a minimal 8-bit CPU.
// Program memory is outside (instr/pc ports) so synthesis can't fold the program away.
// State = pc (8) + 4 regs (32) + out (8) = 48 flip-flops.
//
// instr[15:0] = op[15:12] rd[11:10] rs[9:8] imm[7:0]
//   1 LDI rd = imm      2 ADD rd += rs     3 SUB rd -= rs
//   4 JNZ if rd!=0 pc = imm               5 OUT out = rd     others: NOP
module tiny8 (
    input  wire        clk,
    input  wire        rst_n,
    input  wire [15:0] instr,
    output reg  [7:0]  pc,
    output reg  [7:0]  out
);
    reg  [7:0] r0, r1, r2, r3;
    wire [7:0] rf [0:3];
    assign rf[0] = r0;
    assign rf[1] = r1;
    assign rf[2] = r2;
    assign rf[3] = r3;

    wire [3:0] op  = instr[15:12];
    wire [1:0] rd  = instr[11:10];
    wire [1:0] rs  = instr[9:8];
    wire [7:0] imm = instr[7:0];
    wire [7:0] a   = rf[rd];
    wire [7:0] b   = rf[rs];

    // register-file write: data + enable
    reg [7:0] wdata;
    reg       we;
    always @(*) begin
        we = 1'b1;
        case (op)
            4'd1:    wdata = imm;
            4'd2:    wdata = a + b;
            4'd3:    wdata = a - b;
            default: begin wdata = 8'd0; we = 1'b0; end
        endcase
    end

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            pc  <= 8'd0;
            out <= 8'd0;
            r0  <= 8'd0;
            r1  <= 8'd0;
            r2  <= 8'd0;
            r3  <= 8'd0;
        end else begin
            pc <= (op == 4'd4 && a != 8'd0) ? imm : pc + 8'd1;
            if (op == 4'd5) out <= a;
            if (we) case (rd)
                2'd0: r0 <= wdata;
                2'd1: r1 <= wdata;
                2'd2: r2 <= wdata;
                2'd3: r3 <= wdata;
            endcase
        end
    end
endmodule
